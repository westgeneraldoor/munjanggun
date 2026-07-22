import { expect, test } from '@playwright/test'

async function openPortal(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 900 })
  const response = await page.goto('/api/dev/playwright-login?role=customer&next=/portal')

  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }

  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }
}

test('my page prioritizes one selected activity list on mobile', async ({ page }) => {
  await openPortal(page)

  await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible()
  await expect(page.getByRole('link', { name: '문장군 블로그로 이동' })).toBeVisible()
  await expect(page.getByRole('button', { name: '계정 메뉴' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('heading', { name: '나의 정보' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '고객 서비스' })).toBeVisible()
  await expect(page.getByText('저장한 글', { exact: true })).toHaveCount(0)
  await expect(page.getByText('도움된 글', { exact: true })).toHaveCount(0)

  const activitySelector = page.getByRole('group', { name: '나의 활동 선택' })
  const recentButton = activitySelector.getByRole('button', { name: /최근 본 글/ })
  await expect(recentButton).toHaveAttribute('aria-pressed', 'false')
  await recentButton.click()
  await expect(recentButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: '최근 본 글' })).toBeVisible()

  const box = await recentButton.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: '계정 메뉴' }).click()
  await expect(page.getByRole('button', { name: '계정 메뉴' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('my page validates profile edits before writing', async ({ page }) => {
  await openPortal(page)

  await page.getByRole('button', { name: '수정' }).click()
  const nameInput = page.getByLabel('이름')
  await nameInput.fill('')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('이름은 1~50자로 입력해 주세요.')

  await expect(page.getByLabel('이메일')).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: '취소' }).click()
})
