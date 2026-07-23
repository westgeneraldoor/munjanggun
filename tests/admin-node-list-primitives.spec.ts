import { expect, test } from '@playwright/test'

type FixtureNode = {
  id: string
  parent_id: string | null
  type: 'listing' | 'detail'
  name: string
  slug: string
  status: 'draft' | 'published'
  display_order: number
  image_url: string | null
}

const rootNodes: FixtureNode[] = [
  {
    id: 'root-listing',
    parent_id: null,
    type: 'listing',
    name: '현관문 컬렉션',
    slug: 'front-door-collection',
    status: 'published',
    display_order: 0,
    image_url: '/icon.png',
  },
  {
    id: 'root-detail',
    parent_id: null,
    type: 'detail',
    name: '베이직 제품 상세',
    slug: 'basic-product-detail-with-a-long-mobile-slug',
    status: 'draft',
    display_order: 1,
    image_url: null,
  },
]

async function fulfillNodes(route: import('@playwright/test').Route, nodes: FixtureNode[], status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'content-range': nodes.length ? `0-${nodes.length - 1}/${nodes.length}` : '*/0' },
    body: status === 200 ? JSON.stringify(nodes) : JSON.stringify({ message: 'fixture failure' }),
  })
}

async function expectMinimumTargets(page: import('@playwright/test').Page) {
  const undersized = await page.locator('[data-admin-node-list] button, [data-admin-node-list] a').evaluateAll(elements => elements
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    })
    .map(element => ({ label: element.getAttribute('aria-label') ?? element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  expect(undersized).toEqual([])
}

test('shows load failure, retries, and exposes named controls at 1366px', async ({ page }) => {
  let attempts = 0
  const optimizerRequests: string[] = []
  page.on('request', request => {
    if (/\/_(?:next|vercel)\/image/.test(request.url())) optimizerRequests.push(request.url())
  })
  await page.route('**/rest/v1/nodes*', async route => {
    attempts += 1
    await fulfillNodes(route, attempts === 1 ? [] : rootNodes, attempts === 1 ? 500 : 200)
  })

  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/test-fixtures/admin-node-list', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-admin-node-list]').getByRole('alert')).toContainText('노드 목록을 불러오지 못했습니다.')
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('list', { name: '최상위 노드' })).toBeVisible()
  await expect(page.getByRole('button', { name: '현관문 컬렉션 위로 이동' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '베이직 제품 상세 아래로 이동' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '현관문 컬렉션 이동' })).toBeVisible()
  await expect(page.getByRole('link', { name: '베이직 제품 상세 편집' })).toBeVisible()
  const thumbnail = page.locator('img[data-showroom-image-purpose="thumbnail"]')
  await expect(thumbnail).toHaveAttribute('src', /\/icon\.png$/)
  await expect(thumbnail).toHaveJSProperty('complete', true)
  expect(optimizerRequests).toEqual([])
  await expectMinimumTargets(page)

  const statusButton = page.getByRole('button', { name: '상태: 공개. 초안으로 변경' })
  await statusButton.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(statusButton).toBeFocused()
  const focusStyle = await statusButton.evaluate(element => getComputedStyle(element).outlineStyle)
  expect(focusStyle).not.toBe('none')

  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.screenshot({ path: 'test-results/admin-node-list-desktop.png', fullPage: true })
})

test('restores a validated saved location after hydration without mismatch', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && /hydrat/i.test(message.text())) hydrationErrors.push(message.text())
  })
  await page.route('**/rest/v1/nodes*', async route => {
    const isChildRequest = route.request().url().includes('root-listing')
    await fulfillNodes(route, isChildRequest
      ? [{ ...rootNodes[1], id: 'saved-child', parent_id: 'root-listing', name: '저장된 하위 노드' }]
      : rootNodes)
  })

  await page.goto('/test-fixtures/admin-node-list', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    sessionStorage.setItem('admin_nodes_parentId', JSON.stringify('root-listing'))
    sessionStorage.setItem('admin_nodes_breadcrumb', JSON.stringify([{ id: 'root-listing', name: '현관문 컬렉션' }]))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '현관문 컬렉션의 하위 노드' })).toBeVisible()
  await expect(page.getByText('저장된 하위 노드', { exact: true })).toBeVisible()
  expect(hydrationErrors).toEqual([])
})

test('ignores a stale child response after navigating back home', async ({ page }) => {
  let attempts = 0
  await page.route('**/rest/v1/nodes*', async route => {
    attempts += 1
    if (attempts === 2) {
      await new Promise(resolve => setTimeout(resolve, 600))
      await fulfillNodes(route, [{ ...rootNodes[1], id: 'stale-child', parent_id: 'root-listing', name: '늦게 도착한 하위 노드' }])
      return
    }
    await fulfillNodes(route, rootNodes)
  })

  await page.goto('/test-fixtures/admin-node-list', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '현관문 컬렉션', exact: true }).click()
  const home = page.getByRole('button', { name: '홈' })
  await expect(home).toBeEnabled()
  await home.click()
  await expect(page.getByRole('button', { name: '현관문 컬렉션', exact: true })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByText('늦게 도착한 하위 노드')).toHaveCount(0)
  await expect(page.getByRole('list', { name: '최상위 노드' })).toBeVisible()
})

test('renders real list controls at 390px without overflow and with reduced motion', async ({ page }) => {
  await page.route('**/rest/v1/nodes*', route => fulfillNodes(route, rootNodes))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/test-fixtures/admin-node-list', { waitUntil: 'networkidle' })
  await expect(page.getByRole('list', { name: '최상위 노드' })).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expectMinimumTargets(page)
  const listItem = page.getByRole('listitem').first()
  const transitionSeconds = await listItem.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))
  expect(transitionSeconds).toBeLessThanOrEqual(0.001)

  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.screenshot({ path: 'test-results/admin-node-list-mobile.png', fullPage: true })
})

test('rolls back failed mutations and uses the atomic reorder RPC', async ({ page }) => {
  await page.route('**/rest/v1/nodes*', async route => {
    if (route.request().method() === 'GET') {
      await fulfillNodes(route, rootNodes)
      return
    }
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'delete fixture failure' }) })
  })
  let reorderAttempts = 0
  await page.route('**/rest/v1/rpc/reorder_nodes', async route => {
    reorderAttempts += 1
    if (reorderAttempts === 2) await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill(reorderAttempts === 1
      ? { status: 200, contentType: 'application/json', body: '2' }
      : { status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'reorder fixture failure' }) })
  })

  await page.goto('/test-fixtures/admin-node-list', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '상태: 공개. 초안으로 변경' }).click()
  const mutationAlert = page.locator('[data-admin-node-list]').getByRole('alert')
  await expect(mutationAlert).toContainText('원래 상태로 되돌렸습니다.')
  await expect(page.getByRole('button', { name: '상태: 공개. 초안으로 변경' })).toBeVisible()
  await page.getByRole('button', { name: '알림 닫기' }).click()

  await page.getByRole('button', { name: '현관문 컬렉션 아래로 이동' }).click()
  await expect.poll(async () => page.getByRole('listitem').allTextContents()).toEqual([
    expect.stringContaining('베이직 제품 상세'),
    expect.stringContaining('현관문 컬렉션'),
  ])
  await page.getByRole('button', { name: '현관문 컬렉션 위로 이동' }).click()
  await expect(page.getByRole('button', { name: '상태: 공개. 초안으로 변경' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '베이직 제품 상세 삭제' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '노드 추가' })).toBeDisabled()
  await expect(mutationAlert).toContainText('원래 순서로 되돌렸습니다.')
  expect(reorderAttempts).toBe(2)
  await page.getByRole('button', { name: '알림 닫기' }).click()

  await page.getByRole('button', { name: '베이직 제품 상세 삭제' }).click()
  const deleteDialog = page.getByRole('dialog', { name: '노드 삭제' })
  await deleteDialog.getByRole('button', { name: '삭제하기' }).click()
  await expect(deleteDialog).toBeHidden()
  await expect(mutationAlert).toContainText('노드를 삭제하지 못했습니다.')
})
