import { expect, test, type Page } from '@playwright/test'

async function openBlog(page: Page) {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('blog-home-hero')).toBeVisible()
  await expect(page.getByTestId('blog-navigation')).toHaveAttribute('data-hydrated', 'true')

  // Later assertions use exact programmatic scroll positions. A real wheel input
  // closes the browser's initial LCP window before those synthetic jumps.
  await page.mouse.move(1, 1)
  await page.mouse.wheel(0, 1)
  await page.mouse.wheel(0, -1)
}

test('blog home opens with a full-screen image hero and live navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const blogTheme = page.locator('main[data-mg-theme="blog"][data-mg-blog-experience="showroom"]')
  await expect(blogTheme).toHaveCount(1)
  await expect(blogTheme).toHaveCSS('--mg-blog-canvas', '#fff')
  await expect(blogTheme).toHaveCSS('--mg-blog-font-display', /Tmoney RoundWind/)

  const heroHeight = await page.getByTestId('blog-home-hero').evaluate(element => element.getBoundingClientRect().height)
  expect(heroHeight).toBeGreaterThanOrEqual(880)

  const navigation = page.getByTestId('blog-navigation')
  await expect(navigation).toHaveAttribute('data-condensed', 'false')
  await expect(navigation).toHaveAttribute('data-surface', 'hero')

  const heroNavigationTone = await navigation.evaluate(element => {
    const search = element.querySelector<HTMLButtonElement>('[aria-label="블로그 검색 열기"]')
    const headline = document.querySelector<HTMLElement>('[data-testid="blog-home-hero"] h1')
    return {
      navigationBackground: getComputedStyle(element).backgroundColor,
      searchBackground: search ? getComputedStyle(search).backgroundColor : null,
      headlineFont: headline ? getComputedStyle(headline).fontFamily : null,
    }
  })
  expect(heroNavigationTone.navigationBackground).toBe('rgba(0, 0, 0, 0)')
  expect(heroNavigationTone.searchBackground).toBe('rgba(0, 0, 0, 0)')
  expect(heroNavigationTone.headlineFont).toContain('Tmoney RoundWind')

  const displayFontSurfaces = await page.evaluate(() => [
    '#blog-topics-title',
    '#blog-story-title',
    '#blog-story h3',
    '#blog-condition-title',
    '[data-testid="blog-condition-composer"] p[class*="sentence"]',
    '[data-testid="blog-final-cta-panel"] h2',
    '#blog-footer h2',
  ].flatMap(selector => {
    const element = document.querySelector<HTMLElement>(selector)
    return element ? [{ selector, fontFamily: getComputedStyle(element).fontFamily }] : []
  }))
  for (const surface of displayFontSurfaces) {
    expect(surface.fontFamily, surface.selector).toContain('Tmoney RoundWind')
  }

  for (const href of ['#blog-starter', '#blog-topics', '#blog-story', '#blog-latest']) {
    const link = navigation.locator(`a[href="${href}"]`)
    if (await link.count()) {
      await expect(page.locator(href)).toHaveCount(1)
    }
  }

  await page.evaluate(() => window.scrollTo(0, 360))
  await expect(navigation).toHaveAttribute('data-condensed', 'true')
  await expect(navigation).toHaveAttribute('data-surface', 'light')
  await page.waitForTimeout(240)
  const condensedSearchTone = await navigation.locator('[aria-label="블로그 검색 열기"]').evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))
  expect(condensedSearchTone.background).toBe('rgba(0, 0, 0, 0)')
  expect(condensedSearchTone.color).toBe('rgb(23, 23, 23)')

  const missingHashTargets = await page.evaluate(() => (
    Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
      .map(anchor => anchor.getAttribute('href'))
      .filter((href): href is string => Boolean(href && href.length > 1))
      .filter(href => !document.querySelector(href))
  ))
  expect(missingHashTargets).toEqual([])
})

test('every general blog home consultation CTA uses the public measure entry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const finalPanel = page.getByTestId('blog-final-cta-panel')
  const footer = page.getByTestId('blog-footer')
  const generalConsultationCtas = [
    page.getByTestId('blog-home-hero').getByRole('link', { name: '무료 방문실측 상담' }),
    finalPanel.locator('a').filter({ hasText: '무료 방문실측 상담' }),
    footer.getByRole('link', { name: /무료 방문실측 상담/ }),
    footer.getByRole('link', { name: '무료 방문실측', exact: true }),
  ]

  for (const cta of generalConsultationCtas) {
    await expect(cta).toHaveAttribute('href', '/measure')
  }

  const storyTrack = page.getByTestId('blog-story-track')
  test.skip(await storyTrack.count() === 0, 'No published posts are available, so the consultation chapter is not rendered.')
  await storyTrack.scrollIntoViewIfNeeded()
  const consultationScroll = await storyTrack.evaluate(element => {
    const top = element.getBoundingClientRect().top + window.scrollY
    const distance = element.getBoundingClientRect().height - window.innerHeight
    return Math.round(top + distance * 0.95)
  })
  await page.evaluate(y => window.scrollTo(0, y), consultationScroll)
  await expect(storyTrack.locator('[data-active-index]')).toHaveAttribute('data-active-index', '3')
  await expect(storyTrack.getByRole('link', { name: /무료 방문실측 상담/ })).toHaveAttribute('href', '/measure')
})

test('desktop story stage updates its active chapter through scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const track = page.getByTestId('blog-story-track')
  test.skip(await track.count() === 0, 'No published posts are available, so the article hub is not rendered.')
  const trackTop = await track.evaluate(element => element.getBoundingClientRect().top + window.scrollY)
  await page.evaluate(top => window.scrollTo(0, top), trackTop)
  await expect(track.locator('[data-active-index]')).toHaveAttribute('data-active-index', '0')

  const targetScroll = await track.evaluate(element => {
    const top = element.getBoundingClientRect().top + window.scrollY
    const distance = element.getBoundingClientRect().height - window.innerHeight
    return Math.round(top + distance * 0.62)
  })
  await page.evaluate(y => window.scrollTo(0, y), targetScroll)
  await expect.poll(async () => Number(await track.locator('[data-active-index]').getAttribute('data-active-index'))).toBeGreaterThan(0)
})

test('topic gallery moves on its own and expands a selected card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const rail = page.getByTestId('blog-topic-rail')
  test.skip(await rail.count() === 0, 'No published posts are available, so the topic gallery is not rendered.')
  await rail.scrollIntoViewIfNeeded()

  const initialScroll = await rail.evaluate(element => element.scrollLeft)
  await expect.poll(async () => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialScroll + 10)
  await rail.hover()

  const cards = page.getByTestId('blog-topic-card')
  await expect(cards).toHaveCount(6)
  const card = page.locator('[data-testid="blog-topic-card"][data-focus-distance="0"]')
  await expect(card).toHaveCount(1)
  const collapsedWidth = await card.evaluate(element => element.getBoundingClientRect().width)
  await card.locator('button[aria-expanded]').click()
  await expect(card).toHaveAttribute('data-active', 'true')
  await expect.poll(async () => card.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(collapsedWidth + 120)

  const cardAction = card.locator('button:not([aria-expanded])')
  await expect(cardAction).toBeVisible()
  const cardActionText = await cardAction.innerText()
  await cardAction.click()
  const resultCount = Number(await page.getByTestId('blog-search-results').getAttribute('data-result-count'))
  const displayedCount = cardActionText.match(/관련 글 (\d+)개/)?.[1]
  expect(displayedCount ? Number(displayedCount) : 0).toBe(resultCount)
})

test('topic gallery respects reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const rail = page.getByTestId('blog-topic-rail')
  test.skip(await rail.count() === 0, 'No published posts are available, so the topic gallery is not rendered.')
  await rail.scrollIntoViewIfNeeded()
  const initialScroll = await rail.evaluate(element => element.scrollLeft)
  await page.waitForTimeout(700)
  const finalScroll = await rail.evaluate(element => element.scrollLeft)
  expect(Math.abs(finalScroll - initialScroll)).toBeLessThanOrEqual(1)

  const storyStage = page.getByTestId('blog-story-stage')
  await expect(storyStage).toBeVisible()
  const storyMotion = await storyStage.evaluate(element => {
    const media = element.querySelector('[class*="stageMedia"]')
    const copy = element.querySelector('[class*="stageCopy"]')
    return {
      mediaAnimation: media ? getComputedStyle(media).animationName : null,
      copyAnimation: copy ? getComputedStyle(copy).animationName : null,
    }
  })
  expect(storyMotion.mediaAnimation).toBe('none')
  expect(storyMotion.copyAnimation).toBe('none')
})

test('topic gallery releases a pointer that leaves the rail before dragging', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const rail = page.getByTestId('blog-topic-rail')
  test.skip(await rail.count() === 0, 'No published posts are available, so the topic gallery is not rendered.')
  await rail.scrollIntoViewIfNeeded()

  const positionAfterRelease = await rail.evaluate(element => {
    const railElement = element as HTMLDivElement
    const rect = railElement.getBoundingClientRect()
    railElement.scrollLeft = 500
    railElement.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      buttons: 1,
      clientX: rect.left + 1,
      pointerId: 19,
    }))
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: rect.left - 2,
      pointerId: 19,
    }))
    railElement.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      buttons: 0,
      clientX: rect.left + 120,
      pointerId: 19,
    }))
    return railElement.scrollLeft
  })

  expect(Math.abs(positionAfterRelease - 500)).toBeLessThanOrEqual(1)
})

test('topic gallery returns vertical scrolling after a horizontal edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const rail = page.getByTestId('blog-topic-rail')
  test.skip(await rail.count() === 0, 'No published posts are available, so the topic gallery is not rendered.')
  await rail.scrollIntoViewIfNeeded()

  const interior = await rail.evaluate(element => {
    const railElement = element as HTMLDivElement
    const maxScroll = railElement.scrollWidth - railElement.clientWidth
    return {
      maxScroll,
      left: Math.min(240, Math.max(8, maxScroll / 2)),
      x: railElement.getBoundingClientRect().left + railElement.clientWidth / 2,
      y: railElement.getBoundingClientRect().top + railElement.clientHeight / 2,
    }
  })
  test.skip(interior.maxScroll <= 0, 'The topic gallery does not overflow at this viewport.')

  await rail.evaluate((element, left) => { (element as HTMLDivElement).scrollLeft = left }, interior.left)
  const pageScrollBeforeInterior = await page.evaluate(() => window.scrollY)
  await page.mouse.move(interior.x, interior.y)
  await page.mouse.wheel(0, 180)
  await expect.poll(async () => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(interior.left + 8)
  const pageScrollAfterInterior = await page.evaluate(() => window.scrollY)
  expect(Math.abs(pageScrollAfterInterior - pageScrollBeforeInterior)).toBeLessThanOrEqual(8)

  const edgeScroll = await rail.evaluate((element, maxScroll) => {
    const railElement = element as HTMLDivElement
    railElement.scrollLeft = maxScroll
    const before = window.scrollY
    railElement.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 180 }))
    return window.scrollY - before
  }, interior.maxScroll)
  expect(edgeScroll).toBeGreaterThan(20)
})

test('condition composer opens recommendations and supports editing or restarting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const composer = page.getByTestId('blog-condition-composer')
  test.skip(await composer.count() === 0, 'No published posts are available, so the condition composer is not rendered.')
  await composer.scrollIntoViewIfNeeded()

  const results = page.getByTestId('blog-condition-results')
  await expect(results).toHaveAttribute('aria-hidden', 'true')
  await expect(results.locator('button')).toHaveAttribute('tabindex', '-1')
  await expect(page.getByTestId('blog-condition-word-0')).toContainText('우리 집 공간은?')
  await expect(page.getByTestId('blog-condition-word-1')).toContainText('바꾸고 싶은 점은?')
  await expect(page.getByTestId('blog-condition-word-2')).toContainText('가장 궁금한 건?')

  await page.getByTestId('blog-condition-choice-0-1').click()
  await expect(page.getByTestId('blog-condition-choice-1-1')).toBeVisible()
  const backButton = page.getByRole('button', { name: '이전 질문으로 돌아가기' })
  await expect(backButton).toBeEnabled()
  const backButtonBox = await backButton.boundingBox()
  expect(backButtonBox?.width).toBeGreaterThanOrEqual(44)
  expect(backButtonBox?.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByTestId('blog-condition-word-0')).toContainText('거실과 현관이 바로 이어져')
  await page.getByTestId('blog-condition-choice-1-1').click()
  await expect(page.getByTestId('blog-condition-choice-2-1')).toBeVisible()
  await page.getByTestId('blog-condition-choice-2-1').click()

  await expect(results).toHaveAttribute('data-open', 'true')
  await expect(results).toHaveAttribute('aria-hidden', 'false')
  await expect(results.getByRole('button', { name: '처음부터 다시' })).toBeVisible()
  await results.getByRole('button', { name: '처음부터 다시' }).click()
  await expect(results).toHaveAttribute('data-open', 'false')
  await expect(page.getByTestId('blog-condition-word-0')).toContainText('우리 집 공간은?')
})

test('final consultation scene holds multiple scroll beats before the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const track = page.getByTestId('blog-final-cta-track')
  const panel = page.getByTestId('blog-final-cta-panel')
  const footer = page.getByTestId('blog-footer')
  const hiddenActions = panel.locator('a')
  await expect(hiddenActions).toHaveCount(2)
  for (let index = 0; index < 2; index += 1) {
    await expect(hiddenActions.nth(index)).toHaveAttribute('tabindex', '-1')
  }
  await track.scrollIntoViewIfNeeded()

  const geometry = await track.evaluate(element => ({
    top: element.getBoundingClientRect().top + window.scrollY,
    height: element.getBoundingClientRect().height,
    viewport: window.innerHeight,
  }))
  expect(geometry.height).toBeGreaterThan(geometry.viewport * 2.5)

  await page.evaluate(({ top, height, viewport }) => window.scrollTo(0, top + (height - viewport) * 0.46), geometry)
  await expect.poll(async () => Number(await panel.getAttribute('data-active-state'))).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('blog-navigation')).toHaveAttribute('data-surface', 'dark')
  const footerTopBeforeCompletion = await footer.evaluate(element => element.getBoundingClientRect().top)
  expect(footerTopBeforeCompletion).toBeGreaterThan(geometry.viewport)

  await page.evaluate(({ top, height, viewport }) => window.scrollTo(0, top + height - viewport * 0.08), geometry)
  await expect(footer).toBeVisible()
})

test('mobile blog home keeps the full-screen story sequence without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openBlog(page)

  const track = page.getByTestId('blog-story-track')
  if (await track.count()) {
    await expect(track).toBeVisible()
    const trackHeight = await track.evaluate(element => element.getBoundingClientRect().height)
    expect(trackHeight).toBeGreaterThan(812 * 3)

    const stageHeight = await page.getByTestId('blog-story-stage').evaluate(element => element.getBoundingClientRect().height)
    expect(Math.abs(stageHeight - 812)).toBeLessThanOrEqual(1)
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  const navigationWidth = await page.getByTestId('blog-navigation').evaluate(element => element.getBoundingClientRect().width)
  expect(navigationWidth).toBeLessThanOrEqual(373)

  const topicRail = page.getByTestId('blog-topic-rail')
  if (await topicRail.count()) {
    const cardWidths = await topicRail.evaluate(element => (
      Array.from(element.querySelectorAll('[data-testid="blog-topic-card"]'))
        .map(card => card.getBoundingClientRect().width)
    ))
    expect(cardWidths[0]).toBeLessThan(340)

    const focusedCard = topicRail.locator('[data-testid="blog-topic-card"][data-focus-distance="0"]')
    const collapsedHeight = await focusedCard.evaluate(element => element.getBoundingClientRect().height)
    await focusedCard.locator('button[aria-expanded]').click()
    await expect(focusedCard).toHaveAttribute('data-active', 'true')
    await expect.poll(async () => focusedCard.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.width - rect.height)
    })).toBeLessThanOrEqual(2)
    const selectedGeometry = await focusedCard.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(Math.abs(selectedGeometry.width - selectedGeometry.height)).toBeLessThanOrEqual(2)
    expect(Math.abs(selectedGeometry.height - collapsedHeight)).toBeLessThanOrEqual(2)
  }

  const composer = page.getByTestId('blog-condition-composer')
  if (await composer.count()) {
    const geometry = await composer.evaluate(element => ({
      top: element.getBoundingClientRect().top + window.scrollY,
      height: element.getBoundingClientRect().height,
      viewport: window.innerHeight,
    }))
    expect(Math.abs(geometry.height - geometry.viewport)).toBeLessThanOrEqual(2)

    await page.evaluate(top => window.scrollTo(0, top + 140), geometry.top)
    await expect.poll(async () => composer.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(-1)
    await expect.poll(async () => composer.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThanOrEqual(1)
  }
})

test('mobile completed condition sentence stays clear of the selector', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openBlog(page)

  const composer = page.getByTestId('blog-condition-composer')
  test.skip(await composer.count() === 0, 'No published posts are available, so the condition composer is not rendered.')
  await composer.scrollIntoViewIfNeeded()

  await page.getByTestId('blog-condition-choice-0-0').click()
  await expect(page.getByTestId('blog-condition-choice-1-0')).toBeVisible()
  await page.getByTestId('blog-condition-choice-1-2').click()
  await expect(page.getByTestId('blog-condition-choice-2-0')).toBeVisible()
  await page.getByTestId('blog-condition-choice-2-0').click()
  await expect(composer).toHaveAttribute('data-complete', 'true')

  await expect.poll(async () => composer.evaluate(element => {
    const microcopy = element.querySelector<HTMLElement>('p[class*="microcopy"]')!
    return getComputedStyle(microcopy).display
  })).toBe('none')
  await expect.poll(async () => composer.evaluate(element => {
    const sentence = element.querySelector<HTMLElement>('p[class*="sentence"]')!
    const selector = element.querySelector<HTMLElement>('aside')!
    return Math.round(selector.getBoundingClientRect().top - sentence.getBoundingClientRect().bottom)
  })).toBeGreaterThanOrEqual(12)
})
