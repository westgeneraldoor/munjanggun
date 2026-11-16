import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const localFixtureMode = process.env.PLAYWRIGHT_LOCAL_FIXTURES === '1'
test.use({ hasTouch: true })
const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function openAssets(page: import('@playwright/test').Page) {
  const params = new URLSearchParams({ role: 'administrator', next: '/admin/platform/assets' })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) params.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)
  await page.goto(`/api/dev/playwright-login?${params}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform/assets', { waitUntil: 'networkidle' })
  if (page.url().includes('/admin/login')) test.skip(true, 'administrator session is required')
  await expect(page.getByRole('heading', { name: '사진보관함' })).toBeVisible()
}

async function createLocalSelectionFixtures(page: import('@playwright/test').Page) {
  if (!localFixtureMode) return

  const cards = page.locator('[data-asset-card-button]')
  if (await cards.count() > 0) {
    await expect(cards).toHaveCount(5)
    const addButton = page.getByRole('button', { name: /사진 추가(?: 닫기)?/ })
    if (await addButton.getAttribute('aria-expanded') === 'true') await addButton.click()
    return
  }
  const addButton = page.getByRole('button', { name: /사진 추가(?: 닫기)?/ })
  if (await addButton.getAttribute('aria-expanded') !== 'true') await addButton.click()
  await page.getByLabel('사진 파일 선택').setInputFiles(
    Array.from({ length: 5 }, (_, index) => ({
      name: `range-selection-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: fixturePng,
    })),
  )
  await page.getByRole('checkbox', { name: /민감정보가 보이지 않는지/ }).check()
  await page.getByRole('checkbox', { name: /블로그·홍보용으로 사용할 수 있는 사진인지/ }).check()
  await page.getByRole('button', { name: '사진 보관' }).click()
  await expect(cards).toHaveCount(5, { timeout: 30_000 })
  await page.getByRole('button', { name: '사진 추가 닫기' }).click()
}

async function captureEvidence(page: import('@playwright/test').Page, name: string) {
  await mkdir('output/playwright', { recursive: true })
  await page.screenshot({ path: `output/playwright/${name}.png`, fullPage: true })
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
  const focusProbe = `focus-regression-${Date.now()}`
  await search.fill(focusProbe)
  await expect(page).toHaveURL(new RegExp(`(?:\\?|&)q=${focusProbe}(?:&|$)`))
  await expect(search).toBeFocused()
  await expect(search).toHaveValue(focusProbe)
  await search.pressSequentially('-continued', { delay: 20 })
  await expect(page).toHaveURL(new RegExp(`(?:\\?|&)q=${focusProbe}-continued(?:&|$)`))
  await expect(search).toHaveValue(`${focusProbe}-continued`)
  await expect(search).toBeFocused()
  await search.fill('')
  await expect(page).not.toHaveURL(/(?:\?|&)q=/)
  await expect(search).toHaveValue('')
  await page.getByText('필터', { exact: true }).click()
  const categoryFilter = page.getByLabel('분류')
  await expect(categoryFilter).toBeVisible()
  expect((await categoryFilter.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(page.getByLabel('정렬')).toHaveValue('newest')
  await expect(page.getByLabel('정렬').locator('option')).toHaveCount(6)
  await page.getByLabel('정렬').selectOption('sizeDesc')
  await expect(page).toHaveURL(/(?:\?|&)sort=sizeDesc(?:&|$)/)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByLabel('정렬')).toHaveValue('sizeDesc')
  await page.getByLabel('정렬').selectOption('newest')
  await expect(page).not.toHaveURL(/(?:\?|&)sort=sizeDesc(?:&|$)/)

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

  await createLocalSelectionFixtures(page)

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
  await expect(page.getByRole('button', { name: /현재 페이지 전체 선택/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /현재 페이지 전체 해제/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /검색 결과 전체 선택/ })).toBeVisible()
  await page.getByRole('button', { name: /검색 결과 전체 선택/ }).click()
  await expect(page.getByRole('checkbox', { name: /선택$/ }).first()).toBeDisabled()
  await page.getByRole('button', { name: '선택한 사진 휴지통으로 이동' }).click()
  const allResultsDialog = page.getByRole('dialog', { name: '휴지통 이동' })
  await expect(allResultsDialog).toContainText(/대상: 현재 검색·필터 결과 전체 \d+장/)
  await allResultsDialog.getByRole('button', { name: '취소' }).click()
  await page.getByRole('button', { name: '검색 결과 전체 해제' }).click()

  const cards = page.locator('[data-asset-card-button]')
  await expect(cards).toHaveCount(5)
  const checkboxes = page.getByRole('checkbox', { name: /선택$/ })

  await cards.nth(0).click()
  await cards.nth(4).click({ modifiers: ['Shift'] })
  for (let index = 0; index < 5; index += 1) await expect(checkboxes.nth(index)).toBeChecked()
  await captureEvidence(page, 'pr84-assets-desktop-range-selection')

  await page.getByRole('button', { name: /현재 페이지 전체 해제/ }).click()
  await cards.nth(0).focus()
  await page.keyboard.press('Space')
  await cards.nth(4).focus()
  await page.keyboard.press('Shift+Space')
  for (let index = 0; index < 5; index += 1) await expect(checkboxes.nth(index)).toBeChecked()

  await page.getByRole('button', { name: /현재 페이지 전체 해제/ }).click()
  await checkboxes.nth(0).click()
  await checkboxes.nth(4).click({ modifiers: ['Shift'] })
  for (let index = 0; index < 5; index += 1) await expect(checkboxes.nth(index)).toBeChecked()

  await page.getByRole('button', { name: /현재 페이지 전체 해제/ }).click()
  await checkboxes.nth(0).focus()
  await page.keyboard.press('Space')
  await checkboxes.nth(4).focus()
  await page.keyboard.down('Shift')
  await page.keyboard.press('Space')
  await page.keyboard.up('Shift')
  for (let index = 0; index < 5; index += 1) await expect(checkboxes.nth(index)).toBeChecked()

  await page.getByRole('button', { name: /현재 페이지 전체 해제/ }).click()
  const firstBox = await cards.nth(0).boundingBox()
  const secondBox = await cards.nth(1).boundingBox()
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  if (firstBox && secondBox) {
    await page.mouse.move(firstBox.x + 72, firstBox.y + 96)
    await page.mouse.down()
    await page.mouse.move(secondBox.x + secondBox.width - 12, secondBox.y + secondBox.height - 12, { steps: 6 })
    await expect(page.locator('[data-selection-drag-rect]')).toBeVisible()
    await captureEvidence(page, 'pr84-assets-desktop-drag-selection')
    await page.mouse.up()
    await expect(checkboxes.nth(0)).toBeChecked()
    await expect(checkboxes.nth(1)).toBeChecked()
    await expect(page.getByRole('dialog', { name: /사진 상세/ })).toBeHidden()
  }

  await page.getByRole('button', { name: /현재 페이지 전체 해제/ }).click()
  await cards.nth(0).click()
  await page.getByRole('button', { name: '선택한 사진 휴지통으로 이동' }).click()
  const usageDialog = page.getByRole('dialog', { name: '휴지통 이동' })
  await expect(usageDialog).toBeVisible()
  await usageDialog.getByRole('button', { name: '사용처 확인 후 휴지통으로 이동' }).click()
  const usageResults = usageDialog.getByRole('region', { name: '사용 중인 사진' })
  await expect(usageResults).toContainText('사용 중인 사진은 휴지통으로 이동할 수 없습니다', { timeout: 30_000 })
  await expect(usageResults).toContainText('로컬 QA 목록 첫 번째 글')
  await captureEvidence(page, 'pr84-assets-archive-usage-blocked')
  await usageDialog.getByRole('button', { name: '사용처 보기' }).click()
  await expect(usageResults).toBeFocused()
  await usageDialog.getByRole('button', { name: '취소' }).click()

  await search.fill(`회귀-검색-범위-${Date.now()}`)
  await expect(page.locator('button[aria-pressed]').filter({ hasText: /선택/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '선택한 사진 휴지통으로 이동' })).toHaveCount(0)
  await expect(page).toHaveURL(/(?:\?|&)q=/)
  await search.fill('')
  await expect(page).not.toHaveURL(/(?:\?|&)q=/)

  expect(consoleErrors).toEqual([])
  expect(failedResponses).toEqual([])
})

test('assets route has no 390px horizontal overflow and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openAssets(page)

  await createLocalSelectionFixtures(page)

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
  const cards = page.locator('[data-asset-card-button]')
  await expect(cards).toHaveCount(5)
  await cards.nth(0).tap()
  await cards.nth(1).tap()
  await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(0)).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /선택$/ }).nth(1)).toBeChecked()
  await captureEvidence(page, 'pr84-assets-mobile-touch-selection')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const motion = await firstAsset.evaluate(element => ({
    query: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: Number.parseFloat(getComputedStyle(element).transitionDuration),
  }))
  expect(motion.query).toBe(true)
  expect(motion.duration).toBeLessThanOrEqual(0.001)
})
