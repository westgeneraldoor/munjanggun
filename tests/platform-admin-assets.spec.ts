import { expect, test } from '@playwright/test'

async function openAssets(page: import('@playwright/test').Page) {
  const params = new URLSearchParams({ role: 'administrator', next: '/admin/platform/assets' })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) params.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)
  await page.goto(`/api/dev/playwright-login?${params}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform/assets', { waitUntil: 'networkidle' })
  if (page.url().includes('/admin/login')) test.skip(true, 'administrator session is required')
  await expect(page.getByRole('heading', { name: '사진보관함' })).toBeVisible()
}

test('assets route uses accessible shared controls and preserves GIF intake', async ({ page }) => {
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.setViewportSize({ width: 1366, height: 900 })
  await openAssets(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const search = page.getByRole('searchbox', { name: '사진 검색' })
  await search.focus()
  await expect(search).toBeFocused()
  expect((await search.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.getByText('필터', { exact: true }).click()
  const categoryFilter = page.getByLabel('분류')
  await expect(categoryFilter).toBeVisible()
  expect((await categoryFilter.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(page.getByLabel('정렬')).toHaveValue('newest')
  await expect(page.getByLabel('정렬').locator('option')).toHaveCount(6)

  const addButton = page.getByRole('button', { name: '사진 추가' })
  await addButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '사진 추가 닫기' })).toHaveAttribute('aria-expanded', 'true')

  const fileInput = page.getByLabel('사진 파일 선택')
  await expect(fileInput).toHaveAttribute('accept', /image\/gif/)
  await expect(page.getByRole('button', { name: '사진 보관' })).toBeDisabled()
  const privacyCheck = page.getByRole('checkbox', { name: /민감정보가 보이지 않는지/ })
  await privacyCheck.focus()
  await page.keyboard.press('Space')
  await expect(privacyCheck).toBeChecked()
  await expect(privacyCheck).toBeFocused()
  expect((await privacyCheck.locator('xpath=..').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Space')
  await expect(privacyCheck).not.toBeChecked()

  const targetHeight = await addButton.evaluate(element => element.getBoundingClientRect().height)
  expect(targetHeight).toBeGreaterThanOrEqual(44)

  const firstAsset = page.locator('[data-asset-card-button]').first()
  await expect(firstAsset).toBeVisible()
  await expect(firstAsset.locator('img')).toHaveAttribute('loading', 'lazy')
  await expect(page.getByRole('checkbox', { name: /선택$/ })).toHaveCount(0)
  await firstAsset.press('Enter')
  const detail = page.getByRole('dialog', { name: /사진 상세/ })
  await expect(detail).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(firstAsset).toBeFocused()

  await page.getByRole('button', { name: '선택' }).click()
  const selection = page.getByRole('checkbox', { name: /선택$/ }).first()
  await selection.focus()
  await page.keyboard.press('Space')
  await expect(selection).toBeChecked()
  await expect(page.getByRole('button', { name: '현재 결과 전체 선택' })).toBeVisible()
  await expect(page.getByRole('button', { name: '현재 결과 전체 해제' })).toBeVisible()

  const cards = page.locator('[data-asset-card-button]')
  if (await cards.count() >= 3) {
    await page.getByRole('button', { name: '현재 결과 전체 해제' }).click()
    await cards.nth(0).click()
    await cards.nth(2).click({ modifiers: ['Shift'] })
    await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(0)).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(1)).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(2)).toBeChecked()
  }

  if (await cards.count() >= 2) {
    await page.getByRole('button', { name: '현재 결과 전체 해제' }).click()
    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    if (firstBox && secondBox) {
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 6 })
      await page.mouse.up()
      await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(0)).toBeChecked()
      await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(1)).toBeChecked()
    }
  }

  await page.getByRole('button', { name: '선택한 사진 휴지통으로 이동' }).click()
  await expect(page.getByRole('dialog', { name: '휴지통 이동' })).toBeVisible()
  await expect(page.getByRole('button', { name: '사용처 확인 후 휴지통으로 이동' })).toBeVisible()
  await page.getByRole('button', { name: '취소' }).click()

  expect(consoleErrors).toEqual([])
  expect(failedResponses).toEqual([])
})

test('assets route has no 390px horizontal overflow and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openAssets(page)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByText('필터', { exact: true }).click()
  await expect(page.getByLabel('사용 목적')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const firstAsset = page.locator('[data-asset-card-button]').first()
  await expect(firstAsset).toBeVisible()
  await firstAsset.press('Enter')
  await expect(page.getByRole('dialog', { name: /사진 상세/ })).toBeVisible()
  await page.getByRole('button', { name: '사진 상세 닫기' }).click()
  await expect(firstAsset).toBeFocused()

  await page.getByRole('button', { name: '선택' }).click()
  await firstAsset.tap()
  await expect(page.getByRole('checkbox', { name: /선택$/ }).first()).toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const motion = await firstAsset.evaluate(element => ({
    query: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: Number.parseFloat(getComputedStyle(element).transitionDuration),
  }))
  expect(motion.query).toBe(true)
  expect(motion.duration).toBeLessThanOrEqual(0.001)
})
