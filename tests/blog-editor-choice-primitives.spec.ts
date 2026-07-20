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

test('editor renders shared chips and status badges without live-region semantics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openEditor(page)

  const postStatus = page.getByText('검토중', { exact: true }).first()
  await expect(postStatus).toBeVisible()
  await expect(postStatus).not.toHaveAttribute('role', 'status')
  await expect(page.locator('[data-platform-chip]').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('photo review checkboxes retain native keyboard behavior at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openEditor(page)

  await page.getByRole('button', { name: '교체' }).first().click()
  await expect(page.getByRole('heading', { name: '본문에 넣을 사진 선택' })).toBeVisible()
  await page.getByRole('button', { name: '이 글에서 바로 사진 추가' }).click()

  const privacyCheckbox = page.getByRole('checkbox', { name: /민감정보/ })
  const promotionCheckbox = page.getByRole('checkbox', { name: /블로그·홍보용/ })
  await expect(privacyCheckbox).not.toBeChecked()
  await privacyCheckbox.focus()
  await page.keyboard.press('Space')
  await expect(privacyCheckbox).toBeChecked()
  await expect(promotionCheckbox).toBeEnabled()
  expect(await privacyCheckbox.evaluate(element => element.getAttribute('name'))).toBe('privacyChecked')
  expect(await promotionCheckbox.evaluate(element => element.getAttribute('name'))).toBe('promotionConsentChecked')
  expect(await privacyCheckbox.evaluate(element => element.parentElement?.getBoundingClientRect().height ?? 0)).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('checkbox fixture exposes focus and disabled behavior', async ({ page }) => {
  await page.goto('/test-fixtures/admin-choice')

  const enabledCheckbox = page.getByRole('checkbox', { name: '활성 확인', exact: true })
  const disabledCheckbox = page.getByRole('checkbox', { name: '비활성 확인', exact: true })
  await enabledCheckbox.focus()
  expect(await enabledCheckbox.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Space')
  await expect(enabledCheckbox).toBeChecked()

  await expect(disabledCheckbox).toBeDisabled()
  await expect(disabledCheckbox).not.toBeChecked()
  await disabledCheckbox.evaluate(element => (element as HTMLInputElement).click())
  await expect(disabledCheckbox).not.toBeChecked()
  expect(await disabledCheckbox.evaluate(element => getComputedStyle(element).cursor)).toBe('not-allowed')
})
