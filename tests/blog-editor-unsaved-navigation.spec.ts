import { expect, test, type Page } from '@playwright/test'

const editorPath = process.env.PLAYWRIGHT_BLOG_EDITOR_PATH

async function openEditor(page: Page) {
  const loginParams = new URLSearchParams({
    role: 'administrator',
    next: editorPath ?? '/admin/platform/blog',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) {
    loginParams.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)
  }
  const loginResponse = await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  if (loginResponse && loginResponse.status() >= 500) {
    const errorBody = await loginResponse.json().catch(() => null) as { error?: string } | null
    expect(loginResponse.status(), `Dev administrator login failed: ${errorBody?.error ?? 'unknown error'}`).toBeLessThan(500)
  }

  await page.goto(editorPath ?? '/admin/platform/blog', { waitUntil: 'networkidle' })
  expect(new URL(page.url()).pathname, 'Dev login must establish an administrator session.').not.toBe('/admin/login')

  if (editorPath) return

  const editorLink = page.locator('a[href^="/admin/platform/blog/"]').evaluateAll((links) => links
    .map(link => link.getAttribute('href'))
    .find(href => /^\/admin\/platform\/blog\/[0-9a-f-]{36}$/.test(href ?? '')) ?? null)
  const discoveredPath = await editorLink
  expect(discoveredPath, 'An authenticated blog editor record is required for navigation checks.').not.toBeNull()
  await page.goto(discoveredPath!, { waitUntil: 'networkidle' })
}

function postTitleInput(page: Page) {
  return page.getByTestId('blog-basic-information').getByRole('textbox', { name: '제목', exact: true })
}

test.describe('blog editor unsaved navigation guard', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
    await postTitleInput(page).fill(`저장 전 제목 ${Date.now()}`)
  })

  test('cancel keeps editor state and restores focus', async ({ page }) => {
    const preview = page.getByRole('link', { name: '미리보기' })
    await preview.click()

    const dialog = page.getByRole('dialog', { name: '저장하지 않은 변경 사항' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '계속 편집' }).click()

    await expect(dialog).toBeHidden()
    await expect(preview).toBeFocused()
    await expect(postTitleInput(page)).toHaveValue(/^저장 전 제목/)
  })

  test('confirm discards and navigates to saved preview', async ({ page }) => {
    await page.getByRole('link', { name: '미리보기' }).click()
    const dialog = page.getByRole('dialog', { name: '저장하지 않은 변경 사항' })
    await dialog.getByRole('button', { name: '변경 사항 버리고 미리보기' }).click()
    await expect(page).toHaveURL(/\/admin\/platform\/blog\/[^/]+\/preview$/)
  })

  test('Escape closes the dialog and restores focus', async ({ page }) => {
    const preview = page.getByRole('link', { name: '미리보기' })
    await preview.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(preview).toBeFocused()
  })

  test('Tab cycles inside the dialog', async ({ page }) => {
    await page.getByRole('link', { name: '미리보기' }).click()
    const dialog = page.getByRole('dialog', { name: '저장하지 않은 변경 사항' })
    const cancel = dialog.getByRole('button', { name: '계속 편집' })
    const confirm = dialog.getByRole('button', { name: '변경 사항 버리고 미리보기' })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
  })

  test('beforeunload is registered for reload while dirty', async ({ page }) => {
    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(true)
  })
})
