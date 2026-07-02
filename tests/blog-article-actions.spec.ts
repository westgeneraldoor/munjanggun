import { expect, test, type Page } from '@playwright/test'

async function openFirstBlogPost(page: Page) {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' })

  const firstPostLink = page.locator('main a[href^="/blog/"]').first()
  try {
    await expect(firstPostLink).toBeVisible({ timeout: 8_000 })
  } catch {
    test.skip(true, 'No published blog post is available in this environment.')
  }

  const href = await firstPostLink.getAttribute('href')
  expect(href).toMatch(/^\/blog\/[^/]+$/)

  await page.goto(href!, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    Object.keys(window.localStorage)
      .filter(key => key.startsWith('munjanggun:blog-helpful:') || key.startsWith('munjanggun:blog-question-draft:'))
      .forEach(key => window.localStorage.removeItem(key))
    Object.keys(window.sessionStorage)
      .filter(key => key.startsWith('munjanggun:blog-question-draft:'))
      .forEach(key => window.sessionStorage.removeItem(key))
  })
  await expect(page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })).toBeVisible()
}

async function scrollToAndSettle(page: Page, y: number) {
  await page.evaluate(async (nextY) => {
    window.scrollTo(0, nextY)
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  }, y)
}

test('blog article offers lightweight reader actions', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    })
    document.execCommand = () => true
  })
  await openFirstBlogPost(page)

  const actions = page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })
  await expect(actions).toBeVisible()

  await actions.getByRole('button', { name: '공유하기' }).click()
  await expect(actions.getByRole('status')).toContainText('링크를 복사했어요.')
  await expect(actions.getByRole('button', { name: '도움돼요' })).toBeVisible()

  const questionLink = actions.getByRole('link', { name: /무료 방문실측 상담/ })
  await expect(questionLink).toBeVisible()
  await expect(questionLink).toHaveAttribute('href', /\/portal\/measure\/new\?source=blog-question&post=/)

  await expect(page.getByTestId('blog-question-panel')).toBeVisible()
  await expect(page.getByTestId('blog-question-panel')).toContainText('비공개 질문')
  await expect(page.getByTestId('blog-question-panel')).toContainText('개인정보를 적지 마세요')
})

test('blog article reveals a mobile top reading nav when scrolling upward', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await openFirstBlogPost(page)

  const readingNav = page.locator('nav[aria-label="글 읽기 상단 메뉴"]')
  await expect(readingNav).toBeAttached()
  await expect(readingNav).toHaveAttribute('data-visible', 'false')

  const scrollPositions = await page.evaluate(() => {
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight
    const downY = Math.min(820, Math.floor(maxScrollY * 0.72))
    const upY = Math.max(120, downY - 140)

    return { maxScrollY, downY, upY }
  })
  test.skip(scrollPositions.maxScrollY < 280, 'Article is not tall enough to exercise scroll-direction nav.')

  await scrollToAndSettle(page, scrollPositions.downY)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(scrollPositions.downY - 1)
  await expect(readingNav).toHaveAttribute('data-visible', 'false')
  await expect(readingNav).toHaveAttribute('aria-hidden', 'true')

  await page.mouse.wheel(0, -180)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollPositions.downY)
  await expect(readingNav).toHaveAttribute('data-visible', 'true')
  await expect(readingNav).not.toHaveAttribute('aria-hidden', 'true')

  await expect(readingNav.getByRole('link', { name: '블로그로 돌아가기' })).toHaveAttribute('href', '/blog')
  await expect(readingNav.getByRole('link', { name: '문장군 블로그 홈' })).toHaveAttribute('href', '/blog')
  await expect(readingNav.getByRole('link', { name: '마이페이지로 이동' })).toHaveAttribute('href', '/portal')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('blog article keeps the mobile top reading nav hidden on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openFirstBlogPost(page)

  const readingNav = page.locator('nav[aria-label="글 읽기 상단 메뉴"]')
  await expect(readingNav).toBeAttached()
  await expect(readingNav).toBeHidden()
  await expect(page.getByTestId('blog-mobile-bottom-actions')).toBeHidden()

  await page.evaluate(() => window.scrollTo(0, 820))
  await page.evaluate(() => window.scrollTo(0, 560))
  await expect(readingNav).toBeHidden()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('helpful action stays local to the article', async ({ page }) => {
  await openFirstBlogPost(page)

  const actions = page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })
  await expect(actions.getByRole('button', { name: '도움돼요' })).toBeEnabled()
  await actions.getByRole('button', { name: '도움돼요' }).click()
  await expect(actions.getByRole('status')).toContainText('도움 표시를 저장했어요.')

  await page.reload()
  await expect(page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' }).getByRole('status')).toContainText('도움 표시를 저장했어요.')
})

test('blog article actions do not create mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await openFirstBlogPost(page)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('blog article exposes a mobile bottom action bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    })
    document.execCommand = () => true
  })
  await openFirstBlogPost(page)

  const bottomBar = page.getByTestId('blog-mobile-bottom-actions')
  await expect(bottomBar).toBeVisible()
  await expect(page.getByTestId('blog-mobile-helpful')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('blog-mobile-question')).toHaveAttribute('href', '#blog-question-panel')
  await expect(page.getByTestId('blog-mobile-measure')).toHaveAttribute('href', /\/portal\/measure\/new\?source=blog-question&post=/)

  await expect(page.getByTestId('blog-mobile-helpful')).toBeEnabled()
  await page.getByTestId('blog-mobile-helpful').click()
  await expect(page.getByTestId('blog-mobile-helpful')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('blog-mobile-more').click()
  await expect(page.getByTestId('blog-mobile-more-actions')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('blog-mobile-more-actions')).toBeHidden()
  await expect(page.getByTestId('blog-mobile-more')).toBeFocused()

  await page.getByTestId('blog-mobile-more').click()
  await expect(page.getByTestId('blog-mobile-more-actions')).toBeVisible()
  await page.getByTestId('blog-mobile-share').click()
  await expect(page.getByRole('status')).toContainText('링크를 복사했어요')
  await expect(page.getByTestId('blog-mobile-more-actions')).toBeHidden()
  await expect(page.getByTestId('blog-mobile-more')).toBeFocused()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const finalCta = page.locator('aside a[href="/portal/measure/new"]').last()
  await expect(finalCta).toBeVisible()
  const geometry = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="blog-mobile-bottom-actions"]')
    const cta = [...document.querySelectorAll('aside a[href="/portal/measure/new"]')].at(-1)
    const barBox = bar?.getBoundingClientRect()
    const ctaBox = cta?.getBoundingClientRect()

    return barBox && ctaBox
      ? { barTop: barBox.top, ctaBottom: ctaBox.bottom }
      : null
  })
  expect(geometry).not.toBeNull()
  expect(geometry!.ctaBottom).toBeLessThanOrEqual(geometry!.barTop - 4)

  await page.getByTestId('blog-mobile-question').click()
  await expect(page.getByTestId('blog-question-draft')).toBeFocused()
  await page.getByTestId('blog-question-draft').fill('이 글 기준으로 우리집도 가능한지 궁금해요')
  await page.getByTestId('blog-question-save').click()
  await expect(page.getByRole('status')).toContainText('질문 메모를 현재 탭에 임시 저장했어요.')

  const draftSaved = await page.evaluate(() => Object.keys(window.sessionStorage).some(key => (
    key.startsWith('munjanggun:blog-question-draft:')
      && window.sessionStorage.getItem(key) === '이 글 기준으로 우리집도 가능한지 궁금해요'
  )))
  expect(draftSaved).toBe(true)

  const questionHref = await page.getByTestId('blog-question-continue').getAttribute('href')
  expect(questionHref).toContain('/portal/measure/new?source=blog-question&post=')
  await page.goto(questionHref!)
  await expect(page).toHaveURL(/\/login\?next=/)
  const nextParam = await page.evaluate(() => new URL(window.location.href).searchParams.get('next') ?? '')
  expect(decodeURIComponent(nextParam)).toContain('/portal/measure/new?source=blog-question&post=')
})
