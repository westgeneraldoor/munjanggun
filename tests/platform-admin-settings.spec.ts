import { expect, test, type Page } from '@playwright/test'

async function authenticateAdministrator(page: Page) {
  const params = new URLSearchParams({
    role: 'administrator',
    next: '/admin/platform',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) params.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)

  await page.goto(`/api/dev/playwright-login?${params}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform', { waitUntil: 'domcontentloaded' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')
}

async function loginAsAdministrator(page: Page) {
  await authenticateAdministrator(page)
  await page.goto('/admin/platform/settings', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator session is unavailable in this environment')
  await expect(page.getByRole('heading', { name: '견적 접수 운영설정' })).toBeVisible()
}

test('settings primitives preserve keyboard, selected state, and desktop layout', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await loginAsAdministrator(page)

  const group = page.getByRole('group', { name: '견적 운영설정 구분' })
  const categories = group.getByRole('button', { name: '견적 품목 관리' })
  const schedule = group.getByRole('button', { name: '방문일 운영 설정' })
  await expect(categories).toHaveAttribute('aria-pressed', 'true')
  await schedule.focus()
  await page.keyboard.press('Space')
  await expect(schedule).toHaveAttribute('aria-pressed', 'true')
  await expect(schedule).toBeFocused()

  const saturday = page.getByRole('checkbox', { name: '매주 토요일 자동 마감' })
  const wasSaturdayClosed = await saturday.isChecked()
  await saturday.focus()
  await page.keyboard.press('Space')
  await expect(saturday).toBeChecked({ checked: !wasSaturdayClosed })
  await expect(saturday).toBeFocused()
  expect((await saturday.locator('xpath=..').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Space')
  await expect(saturday).toBeChecked({ checked: wasSaturdayClosed })

  const selectedBeforeHover = await schedule.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  })
  await schedule.hover()
  const selectedAfterHover = await schedule.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  })
  expect(selectedAfterHover).toEqual(selectedBeforeHover)

  await categories.click()
  const firstMoveButton = page.getByRole('button', { name: '위로 이동' }).first()
  if (await firstMoveButton.count()) {
    const box = await firstMoveButton.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await expect(firstMoveButton).toBeDisabled()
  } else {
    await expect(page.getByRole('status').filter({ hasText: '등록된 견적 품목이 없습니다.' })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
})

test('settings stay within 390px and expose validation feedback without a database write', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsAdministrator(page)

  await page.getByRole('group', { name: '견적 운영설정 구분' }).getByRole('button', { name: '방문일 운영 설정' }).click()
  await expect(page.getByRole('checkbox', { name: '공휴일 자동 마감' })).toBeVisible()
  await page.getByLabel('최소 접수 가능일').fill('31')
  await page.getByLabel('최대 예약 가능일').fill('30')
  await page.getByRole('button', { name: '예약 규칙 저장' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '예약 가능일 범위를 확인해 주세요.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('settings render load error and empty states', async ({ page }) => {
  await authenticateAdministrator(page)
  await page.route(/measurement_product_categories/, route => route.abort('failed'))
  await page.goto('/admin/platform/settings', { waitUntil: 'networkidle' })
  await expect(page.getByRole('alert').filter({ hasText: '설정 데이터를 불러오지 못했습니다.' })).toBeVisible()

  await page.unroute(/measurement_product_categories/)
  await page.route(/measurement_product_categories/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': '0-0/0' },
    body: '[]',
  }))
  await page.goto('/admin/platform/settings', { waitUntil: 'networkidle' })
  await expect(page.getByRole('status').filter({ hasText: '등록된 견적 품목이 없습니다.' })).toBeVisible()
})
