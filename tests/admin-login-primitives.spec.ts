import { expect, test } from '@playwright/test'

test('admin login uses shared accessible controls across desktop and 390px', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.route('**/auth/v1/token?grant_type=password', async route => {
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    })
  })

  await page.setViewportSize({ width: 1366, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/admin/login')

  const email = page.getByLabel('이메일')
  const password = page.getByLabel('비밀번호')
  const submit = page.getByRole('button', { name: '로그인' })
  await expect(email).toHaveAttribute('autocomplete', 'email')
  await expect(password).toHaveAttribute('autocomplete', 'current-password')
  expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

  await email.fill('invalid@example.com')
  await password.fill('invalid-password')
  await submit.click()
  await expect(submit).toHaveAttribute('aria-busy', 'true')
  const authError = page.getByRole('alert').filter({ hasText: '이메일 또는 비밀번호가 올바르지 않습니다' })
  await expect(authError).toBeVisible()
  await expect(submit).not.toHaveAttribute('aria-busy', 'true')

  await page.setViewportSize({ width: 390, height: 900 })
  await expect(authError).toBeVisible()
  expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  expect(browserErrors.filter(message => !message.includes('status of 400'))).toEqual([])
})
