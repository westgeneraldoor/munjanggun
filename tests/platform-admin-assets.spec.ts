import { expect, test } from '@playwright/test'

async function openAssets(page: import('@playwright/test').Page) {
  const params = new URLSearchParams({ role: 'administrator', next: '/admin/platform/assets' })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) params.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)
  await page.goto(`/api/dev/playwright-login?${params}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform/assets', { waitUntil: 'networkidle' })
  if (page.url().includes('/admin/login')) test.skip(true, 'administrator session is required')
  await expect(page.getByRole('heading', { name: '사진보관함' })).toBeVisible()
}

test('assets route uses accessible shared controls and preserves GIF intake', async ({ page }) => {
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.setViewportSize({ width: 1366, height: 900 })
  await openAssets(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const search = page.getByRole('searchbox', { name: '사진 검색' })
  await search.focus()
  await expect(search).toBeFocused()
  expect((await search.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.getByText('상세 필터', { exact: true }).click()
  const categoryFilter = page.getByLabel('분류')
  await expect(categoryFilter).toBeVisible()
  expect((await categoryFilter.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

  const addButton = page.getByRole('button', { name: '사진 추가' })
  await addButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '사진 추가 닫기' })).toHaveAttribute('aria-expanded', 'true')

  const fileInput = page.getByLabel('사진 파일 선택')
  await expect(fileInput).toHaveAttribute('accept', /image\/gif/)
  await expect(page.getByRole('button', { name: '사진 보관' })).toBeDisabled()
  const privacyCheck = page.getByRole('checkbox', { name: /민감정보가 보이지 않는지/ })
  await privacyCheck.focus()
  await page.keyboard.press('Space')
  await expect(privacyCheck).toBeChecked()
  await expect(privacyCheck).toBeFocused()
  expect((await privacyCheck.locator('xpath=..').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Space')
  await expect(privacyCheck).not.toBeChecked()

  const targetHeight = await addButton.evaluate(element => element.getBoundingClientRect().height)
  expect(targetHeight).toBeGreaterThanOrEqual(44)

  const assetCards = page.locator('button[aria-pressed]')
  await expect(assetCards).not.toHaveCount(0)
  const firstAsset = assetCards.first()
  await expect(firstAsset).toHaveAttribute('aria-pressed', 'false')
  await firstAsset.press('Enter')
  await expect(firstAsset).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('complementary', { name: '사진 상세 정보' })).toBeVisible()

  expect(consoleErrors).toEqual([])
  expect(failedResponses).toEqual([])
})

test('assets route has no 390px horizontal overflow and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openAssets(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByText('상세 필터', { exact: true }).click()
  await expect(page.getByLabel('사용 목적')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const assetCards = page.locator('button[aria-pressed]')
  await expect(assetCards).not.toHaveCount(0)
  await assetCards.first().press('Enter')
  await expect(page.getByRole('button', { name: '목록으로' })).toBeFocused()
  await page.getByRole('button', { name: '목록으로' }).click()
  await expect(assetCards.first()).toBeFocused()

  const motion = await assetCards.first().evaluate(element => ({
    query: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: Number.parseFloat(getComputedStyle(element).transitionDuration),
  }))
  expect(motion.query).toBe(true)
  expect(motion.duration).toBeLessThanOrEqual(0.001)
})
