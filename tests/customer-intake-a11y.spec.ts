import { expect, test, type Page } from '@playwright/test'

async function loginAsCustomer(page: Page, next: string) {
  const response = await page.goto(`/api/dev/playwright-login?role=customer&next=${encodeURIComponent(next)}`, { waitUntil: 'domcontentloaded' })
  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }
  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, '\\/')}$`))
}

test('measurement contact choice exposes pressed buttons with native keyboard activation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await loginAsCustomer(page, '/portal/measure/new')
  await page.locator('footer button').last().click()

  const group = page.getByRole('group', { name: '연락받을 사람 선택' })
  const applicant = group.getByRole('button', { name: '신청자가 연락받아요' })
  const other = group.getByRole('button', { name: '다른 분이 연락받아요' })
  await expect(applicant).toHaveAttribute('aria-pressed', 'true')
  await expect(other).toHaveAttribute('aria-pressed', 'false')

  await other.focus()
  await page.keyboard.press('Space')
  await expect(applicant).toHaveAttribute('aria-pressed', 'false')
  await expect(other).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[role="radiogroup"]')).toHaveCount(0)
})

test('AS file validation error is an assertive alert at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await loginAsCustomer(page, '/portal/as/new')
  await page.locator('footer button').last().click()

  await page.locator('#as-customer-name').fill('테스트 고객')
  await page.locator('#as-phone').fill('01012345678')
  await page.getByRole('button', { name: '주소 검색' }).click()
  await page.getByRole('button', { name: /수동 입력/ }).last().click()
  await page.locator('#as-address').fill('서울시 테스트구 테스트로 1')
  await page.locator('footer button').last().click()

  await page.locator('#as-files').setInputFiles({
    name: 'not-media.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not media'),
  })
  await expect(page.locator('p[role="alert"]')).toHaveText('사진 또는 동영상 파일만 올릴 수 있어요.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})
