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

  const wordmark = page.getByRole('link', { name: '문장군 블로그로 이동' })
  await expect(wordmark).toHaveAttribute('href', '/blog')
  await expect(wordmark).toContainText('MUNJANGGUN무료견적')
  const wordmarkBox = await wordmark.boundingBox()
  expect(wordmarkBox?.height).toBeGreaterThanOrEqual(44)

  const login = page.getByRole('link', { name: '로그인' })
  await expect(login).toHaveAttribute('href', '/login?next=%2Fmeasure')

  const sticky = page.getByTestId('measure-mobile-cta')
  await expect(sticky).toHaveAttribute('data-visible', 'false')
  await page.getByRole('link', { name: '우리 집 조건 먼저 보기' }).click()
  const [conditionsBox, mobileNavBox] = await Promise.all([
    page.locator('#conditions').boundingBox(),
    page.locator('header').boundingBox(),
  ])
  expect(conditionsBox?.y).toBeGreaterThanOrEqual((mobileNavBox?.height ?? 0) - 1)

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

  const fontResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('TmoneyRoundWind'))
    .map((entry) => ({ name: entry.name, bytes: (entry as PerformanceResourceTiming).encodedBodySize })))
  expect(fontResources.some((entry) => entry.name.endsWith('TmoneyRoundWindExtraBold.measure.woff2'))).toBe(true)
  expect(fontResources.some((entry) => entry.name.endsWith('TmoneyRoundWindExtraBold.ttf'))).toBe(false)
  expect(fontResources.reduce((sum, entry) => sum + entry.bytes, 0)).toBeLessThanOrEqual(80 * 1024)

  const finalSectionTop = await page.locator('section[aria-label="무료방문 실측견적 신청"]').evaluate((section) => (section as HTMLElement).offsetTop)
  await page.evaluate((top) => window.scrollTo(0, top - window.innerHeight + 80), finalSectionTop)
  await expect(sticky).toHaveAttribute('data-visible', 'true')
  await page.getByTestId('measure-final-cta').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('measure-final-cta')).toBeVisible()
  await expect(sticky).toHaveAttribute('data-visible', 'false')
})

for (const viewport of [
  { width: 1366, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`${viewport.width}x${viewport.height} keeps anchors, images, and page bounds intact`, async ({ page }) => {
    const consoleIssues: string[] = []
    const requestFailures: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleIssues.push(`${message.type()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`))
    page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`))

    await page.setViewportSize(viewport)
    await page.goto('/measure', { waitUntil: 'networkidle' })

    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    await expect(page.locator('h1')).toHaveCount(1)

    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((element) => (element as HTMLImageElement).decode())
    }
    const brokenImages = await page.locator('img').evaluateAll((images) => images
      .filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0)
      .map((image) => image.getAttribute('src')))
    expect(brokenImages).toEqual([])
    await page.evaluate(() => window.scrollTo(0, 0))

    for (const linkName of ['현장 조건', '실측 방식', '사진 준비']) {
      const link = page.getByRole('link', { name: linkName, exact: true })
      if (await link.count() === 0 || !await link.isVisible()) continue
      await link.click()
      const targetId = await link.getAttribute('href')
      const target = page.locator(targetId!)
      const [targetBox, navBox] = await Promise.all([target.boundingBox(), page.locator('header').boundingBox()])
      expect(targetBox?.y).toBeGreaterThanOrEqual((navBox?.height ?? 0) - 1)
    }

    expect(consoleIssues).toEqual([])
    expect(requestFailures).toEqual([])
  })
}

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

test('top navigation login keeps the measure explainer as both return and success context', async ({ page }) => {
  await page.goto('/login?next=%2Fmeasure')
  await expect(page.getByRole('heading', { name: '무료방문 실측견적 신청을 이어갈게요' })).toBeVisible()
  await expect(page.getByRole('link', { name: '실측견적 안내로 돌아가기' })).toHaveAttribute('href', '/measure')
})

test('successful email login from the top navigation returns to measure', async ({ page }) => {
  await page.route('**/auth/v1/otp**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/auth/v1/verify**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'playwright-access-token',
        refresh_token: 'playwright-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'measure@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      }),
    })
  })

  await page.goto('/login?next=%2Fmeasure')
  await page.getByRole('button', { name: '이메일로 로그인' }).click()
  await page.getByLabel('이메일 주소').fill('measure@example.com')
  await page.getByRole('button', { name: '인증 코드 받기' }).click()
  await page.getByLabel('인증 코드').fill('123456')
  await page.getByRole('button', { name: '신청 이어가기' }).click()
  await expect(page).toHaveURL(/\/measure$/)
})

test('reduced motion removes measure transition timing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/measure')
  const transitionDuration = await page.getByTestId('measure-hero-cta').evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.00001)
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
