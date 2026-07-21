import { expect, test } from '@playwright/test'

async function openFixture(page: import('@playwright/test').Page) {
  await page.goto('/test-fixtures/admin-switch', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: '관리자 스위치 계약' })).toBeVisible()
}

test('switch supports Space, Enter, click, and disabled semantics', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openFixture(page)
  const control = page.getByRole('switch', { name: /히어로 사용/ })
  const track = control.locator('[data-platform-switch-track]')
  const thumb = control.locator('[data-platform-switch-thumb]')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  const offTrackBox = await track.boundingBox()
  const offThumbBox = await thumb.boundingBox()
  expect(offTrackBox).not.toBeNull()
  expect(offThumbBox).not.toBeNull()
  const offStartInset = offThumbBox!.x - offTrackBox!.x
  await control.focus()
  await page.keyboard.press('Space')
  await expect(control).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('status')).toContainText('현재 상태: 사용')
  await page.keyboard.press('Enter')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  await control.click()
  await expect(control).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => {
    const onTrackBox = await track.boundingBox()
    const onThumbBox = await thumb.boundingBox()
    const onEndInset = onTrackBox!.x + onTrackBox!.width - onThumbBox!.x - onThumbBox!.width
    return Math.abs(onEndInset - offStartInset)
  }).toBeLessThanOrEqual(1)

  await page.locator('html').evaluate(element => element.setAttribute('dir', 'rtl'))
  await expect.poll(async () => {
    const rtlTrackBox = await track.boundingBox()
    const rtlThumbBox = await thumb.boundingBox()
    return Math.abs(rtlThumbBox!.x - rtlTrackBox!.x - offStartInset)
  }).toBeLessThanOrEqual(1)
  const rtlTrackBox = await track.boundingBox()
  const rtlThumbBox = await thumb.boundingBox()
  expect(rtlThumbBox!.x).toBeGreaterThanOrEqual(rtlTrackBox!.x)
  expect(rtlThumbBox!.x + rtlThumbBox!.width).toBeLessThanOrEqual(rtlTrackBox!.x + rtlTrackBox!.width)
  await page.locator('html').evaluate(element => element.setAttribute('dir', 'ltr'))

  const disabled = page.getByRole('switch', { name: '처리 중 스위치' })
  await expect(disabled).toBeDisabled()
  await expect(disabled).toHaveAttribute('aria-checked', 'true')
  const enabledTrack = await control.locator('[data-platform-switch-track]').evaluate(element => getComputedStyle(element).backgroundColor)
  const disabledTrack = await disabled.locator('[data-platform-switch-track]').evaluate(element => getComputedStyle(element).backgroundColor)
  expect(disabledTrack).not.toBe(enabledTrack)
})

test('switch has a 44px target, focus ring, and reduced motion at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFixture(page)
  const control = page.getByRole('switch', { name: /히어로 사용/ })
  const bounds = await control.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.width).toBeGreaterThanOrEqual(44)
  expect(bounds!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await control.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(control).toBeFocused()
  const focusStyle = await control.evaluate(element => getComputedStyle(element).outlineStyle)
  expect(focusStyle).not.toBe('none')
  const transitionSeconds = await control.locator('span').last().evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))
  expect(transitionSeconds).toBeLessThanOrEqual(0.001)

  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.screenshot({ path: 'test-results/admin-switch-mobile.png', fullPage: true })
})
