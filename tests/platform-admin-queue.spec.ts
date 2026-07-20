import { expect, test } from '@playwright/test'

async function openQueue(page: import('@playwright/test').Page) {
  await page.goto('/test-fixtures/admin-queue')
  await expect(page.getByRole('heading', { name: '통합 접수 큐' })).toBeVisible()
}

test('queue filters, sorting, and detail selection expose shared accessible state', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openQueue(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.locator('table[data-platform-table]')).toBeVisible()
  await expect(page.getByRole('table', { name: '통합 접수 목록' })).toHaveCount(1)
  await expect(page.getByRole('list', { name: '통합 접수 모바일 목록' })).toBeHidden()
  await expect(page.getByRole('button', { name: '확인필요' })).toHaveAttribute('aria-pressed', 'true')

  const receivedHeader = page.getByRole('columnheader', { name: /접수일시/ })
  await expect(receivedHeader).toHaveAttribute('aria-sort', 'descending')

  const selectionButtons = page.locator('button[data-queue-select="desktop"]')
  await expect(selectionButtons).toHaveCount(1)
  await expect(selectionButtons).toHaveAttribute('aria-label', /접수 상세 열기$/)
  await selectionButtons.press('Enter')
  await expect(selectionButtons).toHaveAttribute('aria-pressed', 'true')
  await expect(selectionButtons).toHaveAttribute('aria-label', /접수 상세 닫기$/)
  await expect(page.getByRole('complementary', { name: '접수 상세' })).toBeVisible()
})

test('queue mobile detail moves and restores focus without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openQueue(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('table', { name: '통합 접수 목록' })).toBeHidden()
  await expect(page.getByRole('list', { name: '통합 접수 모바일 목록' })).toBeVisible()
  const selectionButtons = page.locator('button[data-queue-select="mobile"]')
  await expect(selectionButtons).toHaveCount(1)
  await selectionButtons.press('Enter')
  await expect(page.getByRole('button', { name: '목록' })).toBeFocused()
  await page.getByRole('button', { name: '목록' }).click()
  await expect(selectionButtons).toBeFocused()
})

test('queue intermediate width keeps detail actions visible and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 900 })
  await openQueue(page)

  await expect(page.getByRole('table', { name: '통합 접수 목록' })).toBeVisible()
  const selectionButton = page.locator('button[data-queue-select="desktop"]')
  await selectionButton.press('Enter')
  await expect(page.getByRole('complementary', { name: '접수 상세' })).toBeVisible()
  await expect(page.getByRole('button', { name: '목록' })).toBeFocused()
  await page.getByRole('button', { name: '목록' }).click()
  await expect(selectionButton).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('queue completion announces success and moves focus to a stable target', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.route('**/api/platform/admin-queue-action', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ customerStatus: 'confirmed', queueStatus: 'new_done' }),
  }))
  await openQueue(page)

  await page.locator('button[data-queue-select="desktop"]').press('Enter')
  await page.getByRole('button', { name: '접수완료' }).click()

  await expect(page.locator('[data-queue-summary]')).toBeFocused()
  await expect(page.locator('[data-queue-status]')).toHaveText('처리 상태를 저장했습니다.')
  await expect(page.locator('button[data-queue-select="desktop"]')).toHaveCount(0)
})
