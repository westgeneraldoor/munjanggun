import { expect, test, type Page } from '@playwright/test'

async function openApprovedManuscriptIntake(page: Page) {
  const params = new URLSearchParams({
    role: 'administrator',
    next: '/admin/platform/blog/new',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) params.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)

  await page.goto(`/api/dev/playwright-login?${params}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform/blog/new', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')
  await expect(page.getByRole('heading', { name: '승인 원고 등록' })).toBeVisible()
}

test('approved manuscript intake preserves sections, validation, and toolbar keyboard order', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openApprovedManuscriptIntake(page)

  await expect(page.locator('fieldset')).toHaveCount(3)
  await expect(page.getByLabel('제목', { exact: true })).toHaveAttribute('required', '')
  await expect(page.getByLabel('slug')).toHaveAttribute('pattern', '[a-z0-9]+(?:-[a-z0-9]+)*')

  await page.getByLabel('추가할 블록 유형').selectOption('heading')
  await page.getByRole('button', { name: '블록 추가' }).click()
  await expect(page.getByRole('toolbar')).toHaveCount(2)
  await expect(page.getByLabel('제목 수준')).toBeVisible()

  const firstToolbar = page.getByRole('toolbar', { name: '1번 블록 작업' })
  const moveDown = firstToolbar.getByRole('button', { name: '1번 블록 아래로 이동' })
  const remove = firstToolbar.getByRole('button', { name: '1번 블록 삭제' })
  await expect(moveDown).toHaveAttribute('tabindex', '0')
  await expect(remove).toHaveAttribute('tabindex', '-1')
  await moveDown.focus()
  await page.keyboard.press('ArrowRight')
  await expect(remove).toBeFocused()
  await expect(moveDown).toHaveAttribute('tabindex', '-1')
  await expect(remove).toHaveAttribute('tabindex', '0')
  await page.keyboard.press('Home')
  await expect(moveDown).toBeFocused()
  await page.keyboard.press('End')
  await expect(remove).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('본문', { exact: true })).toBeFocused()

  await moveDown.focus()
  await page.keyboard.press('Enter')
  const movedBlockToolbar = page.getByRole('toolbar', { name: '2번 블록 작업' })
  const recoveredMoveUp = movedBlockToolbar.getByRole('button', { name: '2번 블록 위로 이동' })
  await expect(recoveredMoveUp).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(movedBlockToolbar.getByRole('button', { name: '2번 블록 삭제' })).toBeFocused()

  await page.getByLabel('slug').fill('Invalid Slug')
  expect(await page.getByLabel('slug').evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('approved manuscript intake fits 390px with visible focus and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApprovedManuscriptIntake(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const addButton = page.getByRole('button', { name: '블록 추가' })
  const addBounds = await addButton.boundingBox()
  expect(addBounds?.width).toBeGreaterThanOrEqual(44)
  expect(addBounds?.height).toBeGreaterThanOrEqual(44)

  const title = page.getByLabel('제목', { exact: true })
  await title.focus()
  const focusShadow = await title.evaluate(element => getComputedStyle(element).boxShadow)
  expect(focusShadow).not.toBe('none')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  const transitionDuration = await title.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))
  expect(transitionDuration).toBeLessThanOrEqual(0.001)
})
