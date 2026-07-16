import { expect, test } from '@playwright/test'

async function openDetail(page: import('@playwright/test').Page) {
  await page.goto('/test-fixtures/admin-detail', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '접수 상세' })).toBeVisible()
}

async function expectMinimumTargets(page: import('@playwright/test').Page) {
  const undersized = await page.locator('[data-admin-detail] button, [data-admin-detail] a, [data-admin-detail] select, [data-admin-detail] textarea').evaluateAll(elements => elements
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    })
    .map(element => ({ tag: element.tagName, text: element.textContent?.trim(), rect: element.getBoundingClientRect().toJSON() })))
  expect(undersized).toEqual([])
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
    const linear = channels.map(channel => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const values = [luminance(foreground), luminance(background)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}

test('detail actions announce copy and save outcomes at 1366px', async ({ page, context }) => {
  const consoleErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.setViewportSize({ width: 1366, height: 900 })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  let releaseSave!: () => void
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve })
  await page.route('**/api/platform/measure/*/status', async route => {
    await saveGate
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await openDetail(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expectMinimumTargets(page)
  await expect(page.getByLabel('접수 상태')).toHaveValue('contacted')

  const copyButton = page.getByRole('button', { name: '전화번호 복사' }).first()
  await copyButton.click()
  await expect(page.getByRole('button', { name: '전화번호 복사 완료' })).toContainText('복사됨')

  const saveButton = page.locator('#btn-save-status')
  const defaultColors = await saveButton.evaluate(element => {
    const styles = getComputedStyle(element)
    return { color: styles.color, background: styles.backgroundColor }
  })
  expect(contrastRatio(defaultColors.color, defaultColors.background)).toBeGreaterThanOrEqual(4.5)
  await saveButton.hover()
  const hoverColors = await saveButton.evaluate(element => {
    const styles = getComputedStyle(element)
    return { color: styles.color, background: styles.backgroundColor }
  })
  expect(contrastRatio(hoverColors.color, hoverColors.background)).toBeGreaterThanOrEqual(4.5)
  await saveButton.click()
  await expect(saveButton).toBeDisabled()
  await expect(saveButton).toHaveAttribute('aria-busy', 'true')
  releaseSave()
  await expect(page.getByRole('status')).toContainText('저장했습니다')
  await expect(saveButton).toBeFocused()
  expect(consoleErrors).toEqual([])
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.locator('[data-admin-detail]').screenshot({ path: 'test-results/admin-detail-desktop.png' })
})

test('detail private media exposes failure, retry, and an opaque signed link', async ({ page }) => {
  const invalidMediaResponse = await page.request.get('/api/platform/measure/media-file?media_id=not-a-uuid')
  expect(invalidMediaResponse.status()).toBe(400)
  const unauthorizedMediaResponse = await page.request.get(
    '/api/platform/measure/media-file?media_id=00000000-0000-4000-8000-000000000002',
    { headers: { Range: 'bytes=0-0' } },
  )
  expect(unauthorizedMediaResponse.status()).toBe(401)

  let attempts = 0
  await page.route('**/api/platform/measure/media-url?**', route => {
    const requestUrl = new URL(route.request().url())
    expect(requestUrl.searchParams.has('object_path')).toBe(false)
    expect(requestUrl.searchParams.get('media_id')).toBe('00000000-0000-4000-8000-000000000002')
    attempts += 1
    if (attempts === 1) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'fixture failure' }) })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: '/api/platform/measure/media-file?media_id=00000000-0000-4000-8000-000000000002' }),
    })
  })
  await openDetail(page)

  const previewButton = page.getByRole('button', { name: 'fixture-image.jpg 미리보기' })
  await previewButton.click()
  const mediaError = page.getByRole('alert').filter({ hasText: '미디어를 불러오지 못했습니다' })
  await expect(mediaError).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'fixture-image.jpg 다시 시도' })
  await expect(retryButton).toHaveAccessibleDescription(/미디어를 불러오지 못했습니다/)

  await retryButton.click()
  const signedLink = page.getByRole('link', { name: 'fixture-image.jpg 새 창에서 열기' })
  await expect(signedLink).toHaveAttribute('href', '/api/platform/measure/media-file?media_id=00000000-0000-4000-8000-000000000002')
  await expect(signedLink).toHaveAttribute('target', '_blank')
  await expect(signedLink).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('a[href*="storage/v1/object/sign"], a[href*="test-fixtures/private-media/image.jpg"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'fixture-image.jpg 보안 링크 다시 받기' }).click()
  await expect.poll(() => attempts).toBe(3)
  await expect(signedLink).toHaveAttribute('href', '/api/platform/measure/media-file?media_id=00000000-0000-4000-8000-000000000002')
})

test('detail exposes clipboard and save failures at runtime', async ({ page }) => {
  await page.route('**/api/platform/measure/*/status', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'fixture save failure' }),
  }))
  await openDetail(page)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('fixture clipboard failure') } },
    })
  })

  await page.getByRole('button', { name: '전화번호 복사' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '클립보드에 복사하지 못했습니다.' })).toBeVisible()

  await page.locator('#btn-save-status').click()
  await expect(page.getByRole('alert').filter({ hasText: '저장 실패: fixture save failure' })).toBeVisible()
})

test('detail remains keyboard-usable without overflow at 390px and reduced motion', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openDetail(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await expectMinimumTargets(page)
  const selectContract = page.locator('select.fixture-select-contract')
  await expect(selectContract).toHaveCount(1)
  await expect(selectContract).toHaveClass(/fixture-select-contract/)

  const backLink = page.getByRole('link', { name: '접수 목록으로' })
  await backLink.focus()
  await expect(backLink).toBeFocused()
  await page.keyboard.press('Tab')
  const phoneCopy = page.getByRole('button', { name: '전화번호 복사' })
  await expect(phoneCopy).toBeFocused()
  const focusState = await phoneCopy.evaluate(element => {
    const styles = getComputedStyle(element)
    return { outlineStyle: styles.outlineStyle, outlineWidth: styles.outlineWidth, transitionDuration: styles.transitionDuration }
  })
  expect(focusState.outlineStyle).not.toBe('none')
  expect(focusState.outlineWidth).not.toBe('0px')
  expect(focusState.transitionDuration.split(',').every(value => Number.parseFloat(value) <= 0.001)).toBe(true)
  expect(consoleErrors).toEqual([])
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.locator('[data-admin-detail]').screenshot({ path: 'test-results/admin-detail-mobile.png' })
})
