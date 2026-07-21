import { expect, test, type Page } from '@playwright/test'

const configuredEditorPath = process.env.PLAYWRIGHT_BLOG_EDITOR_PATH

async function openEditor(page: Page) {
  const loginParams = new URLSearchParams({
    role: 'administrator',
    next: configuredEditorPath ?? '/admin/platform/blog',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) loginParams.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)

  await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  await page.goto(configuredEditorPath ?? '/admin/platform/blog', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')

  if (!configuredEditorPath) {
    const editorPath = await page.locator('a[href^="/admin/platform/blog/"]').evaluateAll(links => links
      .map(link => link.getAttribute('href'))
      .find(href => /^\/admin\/platform\/blog\/[0-9a-f-]{36}$/.test(href ?? '')) ?? null)
    expect(editorPath, 'an authenticated blog editor record is required').not.toBeNull()
    await page.goto(editorPath!, { waitUntil: 'networkidle' })
  }

  await expect(page.getByTestId('blog-writing-canvas')).toBeVisible()
}

async function openAssetPicker(page: Page) {
  const opener = page.getByRole('button', { name: '교체' }).first()
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '본문에 넣을 사진 선택' })
  await expect(dialog).toBeVisible()
  return { opener, dialog }
}

test('asset picker traps focus, closes with Escape, and restores its opener', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openEditor(page)

  const { opener, dialog } = await openAssetPicker(page)
  await expect(page.getByRole('button', { name: '이 글에서 바로 사진 추가' })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('asset picker fits 390px with reduced motion and keeps focus inside', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEditor(page)

  const { dialog } = await openAssetPicker(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  expect(await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight
  })).toBe(true)
  expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  const applyButton = page.getByRole('button', { name: '본문에 넣기' })
  await expect(applyButton).toBeVisible()
  expect(await applyButton.evaluate((button) => {
    const dialogElement = button.closest('[role="dialog"]')
    if (!dialogElement) return false
    const buttonRect = button.getBoundingClientRect()
    const dialogRect = dialogElement.getBoundingClientRect()
    return buttonRect.height > 0
      && buttonRect.top >= dialogRect.top
      && buttonRect.bottom <= dialogRect.bottom
  })).toBe(true)
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
})
