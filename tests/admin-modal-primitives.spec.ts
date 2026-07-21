import { expect, test } from '@playwright/test'

async function openFixture(page: import('@playwright/test').Page) {
  await page.goto('/test-fixtures/admin-modal', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '관리자 모달 계약' })).toBeVisible()
}

async function expectMinimumTargets(page: import('@playwright/test').Page) {
  const undersized = await page.locator([
    '[data-admin-modal-fixture] button',
    '[data-admin-modal-fixture] input:not([type="radio"])',
    '[data-admin-modal-fixture] select',
    '[data-admin-modal-fixture] label:has(input[type="radio"])',
  ].join(',')).evaluateAll(elements => elements
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    })
    .map(element => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  expect(undersized).toEqual([])
}

test('modal traps focus, closes with Escape, and restores the opener at 1366px', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openFixture(page)

  const opener = page.getByRole('button', { name: '확인 모달 열기' })
  await opener.focus()
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '노드 삭제 확인' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: '취소' })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await expectMinimumTargets(page)

  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: '삭제하기' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '취소' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')

  await opener.click()
  await page.getByRole('button', { name: '삭제하기' }).click()
  await expect(page.getByRole('status')).toContainText('삭제 확인을 선택했습니다.')
  await expect(opener).toBeFocused()

  let insertedNode: Record<string, unknown> | undefined
  await page.route('**/rest/v1/nodes*', async route => {
    if (route.request().method() === 'POST') insertedNode = route.request().postDataJSON()
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })
  await page.getByRole('button', { name: '자식 노드 추가 열기' }).click()
  const nodeAddDialog = page.getByRole('dialog', { name: '자식 노드 추가' })
  await expect(nodeAddDialog).toBeVisible()
  await expect(nodeAddDialog.getByRole('combobox', { name: '노드 타입 *' })).toHaveValue('detail')
  await nodeAddDialog.getByRole('textbox', { name: '이름 *' }).fill('child-node')
  await expect(nodeAddDialog.getByRole('textbox', { name: 'URL 슬러그 *' })).toHaveValue('child-node')
  await nodeAddDialog.getByRole('button', { name: '추가하기' }).click()
  await expect(nodeAddDialog).toBeHidden()
  expect(insertedNode).toMatchObject({ parent_id: 'fixture-parent', type: 'detail' })
})

test('loading modal blocks Escape and all close actions', async ({ page }) => {
  await openFixture(page)
  await page.getByRole('button', { name: '처리 중 모달 열기' }).click()
  const dialog = page.getByRole('dialog', { name: '노드 처리 중' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '취소' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '처리 중' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '처리 중' })).toHaveAttribute('aria-busy', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused()
})

test('node move blocks a failed candidate load and recovers through retry', async ({ page }) => {
  let attempts = 0
  await page.route('**/rest/v1/nodes*', async route => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'fixture failure' }) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-1/2' },
      body: JSON.stringify([
        { id: 'current-parent', name: '현재 위치', parent_id: null, type: 'listing' },
        { id: 'other-parent', name: '다른 위치', parent_id: null, type: 'listing' },
      ]),
    })
  })
  await openFixture(page)
  await page.getByRole('button', { name: '노드 이동 열기' }).click()
  const dialog = page.getByRole('dialog', { name: '노드 이동' })
  await expect(dialog.getByRole('alert')).toContainText('이동 가능한 위치를 불러오지 못했습니다.')
  await expect(dialog.getByRole('button', { name: '이동하기' })).toBeDisabled()
  await dialog.getByRole('button', { name: '다시 시도' }).click()
  await expect(dialog.getByText('다른 위치')).toBeVisible()
  await expect(dialog.getByRole('radio', { name: '현재 위치 (현재 위치)' })).toBeDisabled()
  await dialog.getByRole('radio', { name: '다른 위치' }).check()
  await expect(dialog.getByRole('button', { name: '이동하기' })).toBeEnabled()
  await expectMinimumTargets(page)
})

test('closable modal works at 390px with reduced motion and no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFixture(page)
  const opener = page.getByRole('button', { name: '닫기 버튼 모달 열기' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '닫기 버튼 계약' })
  await expect(dialog).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expectMinimumTargets(page)
  const motion = await dialog.evaluate(element => getComputedStyle(element).animationName)
  expect(motion).toBe('none')

  const closeButton = dialog.getByRole('button', { name: '닫기' })
  await expect(dialog.getByRole('button', { name: '확인' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(closeButton).toBeFocused()
  const focusStyle = await closeButton.evaluate(element => {
    const styles = getComputedStyle(element)
    return { outlineStyle: styles.outlineStyle, outlineWidth: styles.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.screenshot({ path: 'test-results/admin-modal-mobile.png', fullPage: true })
  await closeButton.click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()

  await opener.click()
  await page.locator('[data-platform-modal-overlay]').click({ position: { x: 1, y: 1 } })
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()

  await page.getByRole('button', { name: '자식 노드 추가 열기' }).click()
  const nodeAddDialog = page.getByRole('dialog', { name: '자식 노드 추가' })
  await expect(nodeAddDialog).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await nodeAddDialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expectMinimumTargets(page)
  await nodeAddDialog.getByRole('button', { name: '닫기' }).click()

  await page.route('**/rest/v1/nodes*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'current-parent', name: '현재 위치', parent_id: null, type: 'listing' },
        ...Array.from({ length: 8 }, (_, index) => ({
          id: `mobile-parent-${index}`,
          name: `모바일 이동 후보 ${index + 1}`,
          parent_id: null,
          type: 'listing',
        })),
      ]),
    })
  })
  await page.getByRole('button', { name: '노드 이동 열기' }).click()
  const nodeMoveDialog = page.getByRole('dialog', { name: '노드 이동' })
  await expect(nodeMoveDialog.getByText('모바일 이동 후보 8')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await nodeMoveDialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expectMinimumTargets(page)
  await nodeMoveDialog.getByRole('button', { name: '닫기' }).click()
})
