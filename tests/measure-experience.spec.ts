import { expect, test } from '@playwright/test'

test('mobile measure interaction preserves context without duplicate sticky CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/measure', { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle(/무료방문 실측견적/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(4800)

  const skip = page.getByRole('link', { name: '본문으로 건너뛰기' })
  const initialBox = await skip.boundingBox()
  expect(initialBox && initialBox.y + initialBox.height).toBeLessThanOrEqual(0)
  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
  const focusedBox = await skip.boundingBox()
  expect(focusedBox?.y).toBeGreaterThanOrEqual(0)

  const sticky = page.getByTestId('measure-mobile-cta')
  await expect(sticky).toHaveAttribute('data-visible', 'false')
  await page.getByRole('button', { name: /스위치·몰딩/ }).click()
  await expect(page.getByTestId('measure-context-cta')).toHaveAttribute('href', '/portal/measure/new?concern=finish')
  const moldingHotspot = page.getByRole('button', { name: /천장 몰딩:/ })
  await moldingHotspot.click()
  const hotspotBox = await moldingHotspot.boundingBox()
  expect(hotspotBox?.width).toBeGreaterThanOrEqual(44)
  expect(hotspotBox?.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByTestId('hotspot-detail')).toContainText('몰딩을 끊거나 덧대야 하는 구간')

  await page.locator('#conditions').scrollIntoViewIfNeeded()
  await expect(sticky).toHaveAttribute('data-visible', 'true')
  await expect(sticky).toHaveAttribute('href', '/portal/measure/new?concern=finish')

  const undersizedDisplayText = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3'))
    .filter((element) => getComputedStyle(element).fontFamily.toLowerCase().includes('roundwind') && Number.parseFloat(getComputedStyle(element).fontSize) < 32)
    .map((element) => element.textContent?.trim()))
  expect(undersizedDisplayText).toEqual([])

  const imageBytes = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/images/measure/v2/'))
    .reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize || (entry as PerformanceResourceTiming).encodedBodySize), 0))
  expect(imageBytes).toBeLessThanOrEqual(1.5 * 1024 * 1024)

  const finalSectionTop = await page.locator('section[aria-label="무료방문 실측견적 신청"]').evaluate((section) => (section as HTMLElement).offsetTop)
  await page.evaluate((top) => window.scrollTo(0, top - window.innerHeight + 80), finalSectionTop)
  await expect(sticky).toHaveAttribute('data-visible', 'true')
  await page.getByTestId('measure-final-cta').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('measure-final-cta')).toBeVisible()
  await expect(sticky).toHaveAttribute('data-visible', 'false')
})

test('phone landscape keeps the contextual CTA and hero copy usable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/measure')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  const heroHeight = await page.getByRole('heading', { level: 1 }).evaluate((heading) => heading.getBoundingClientRect().height)
  expect(heroHeight).toBeLessThan(190)
  await page.locator('#conditions').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('measure-mobile-cta')).toHaveAttribute('data-visible', 'true')
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible()
})

test('measure login names the route and offers the correct visible return link', async ({ page }) => {
  const next = '/portal/measure/new?concern=finish'
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(page).toHaveTitle(/문장군 로그인/)
  await expect(page.getByRole('heading', { name: '무료방문 실측견적 신청을 이어갈게요' })).toBeVisible()
  const returnLink = page.getByRole('link', { name: '실측견적 안내로 돌아가기' })
  await expect(returnLink).toBeVisible()
  await expect(returnLink).toHaveAttribute('href', '/measure')
})

test('blog-question login returns to the originating article context', async ({ page }) => {
  const next = '/portal/measure/new?source=blog-question&post=door-guide'
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  const returnLink = page.getByRole('link', { name: '블로그 글로 돌아가기' })
  await expect(returnLink).toBeVisible()
  await expect(returnLink).toHaveAttribute('href', '/blog/door-guide')
})

test('login rejects a backslash next-path redirect bypass', async ({ page }) => {
  await page.goto('/login?next=%2F%5Cevil.com')
  await expect(page.getByRole('link', { name: '문장군 홈으로 돌아가기' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: '실측견적 안내로 돌아가기' })).toHaveCount(0)
})
