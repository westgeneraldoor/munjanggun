import { expect, test, type Page } from '@playwright/test'

const configuredEditorPath = process.env.PLAYWRIGHT_BLOG_EDITOR_PATH

async function openEditor(page: Page) {
  const loginParams = new URLSearchParams({
    role: 'administrator',
    next: configuredEditorPath ?? '/admin/platform/blog',
  })
  await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  await page.goto(configuredEditorPath ?? '/admin/platform/blog', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')
  if (!configuredEditorPath) {
    const editorPath = await page.locator('a[href^="/admin/platform/blog/"]').evaluateAll(links => links
      .map(link => link.getAttribute('href'))
      .find(href => /^\/admin\/platform\/blog\/[0-9a-f-]{36}$/.test(href ?? '')) ?? null)
    expect(editorPath).not.toBeNull()
    await page.goto(editorPath!, { waitUntil: 'networkidle' })
  }
  await expect(page.getByTestId('blog-writing-canvas')).toBeVisible()
}

test('asset upload failure is assertive while progress remains polite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEditor(page)

  await page.getByRole('button', { name: '교체' }).first().click()
  const dialog = page.getByRole('dialog', { name: '본문에 넣을 사진 선택' })
  await dialog.getByRole('button', { name: '이 글에서 바로 사진 추가' }).click()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'unsupported.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  })
  await dialog.getByRole('checkbox').nth(0).check()
  await dialog.getByRole('checkbox').nth(1).check()
  await dialog.getByRole('button', { name: '사진 보관' }).click()

  await expect(dialog.getByRole('status').filter({ hasText: /사진을 정리하고 있습니다|사진 정리 완료/ })).toBeVisible()
  const error = dialog.getByRole('alert').filter({ hasText: '0/1장 업로드 완료' })
  await expect(error).toBeVisible()
  await expect(error).toHaveAttribute('aria-live', 'assertive')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})
