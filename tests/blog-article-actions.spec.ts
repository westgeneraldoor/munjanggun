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

test('blog article exposes current-article reading progress on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await openFirstBlogPost(page)

  const readingNav = page.getByTestId('blog-navigation')
  const progressbar = readingNav.getByRole('progressbar', { name: '글 읽기 진행률' })
  await expect(readingNav).toBeVisible()
  await expect(progressbar).toHaveAttribute('aria-valuenow', '0')

  const targetScrollY = await page.evaluate(() => {
    const article = document.getElementById('blog-article')
    if (!article) return null
    const articleTop = article.getBoundingClientRect().top + window.scrollY
    const articleBottom = articleTop + article.offsetHeight
    const readableEnd = articleBottom - window.innerHeight
    if (readableEnd <= articleTop) return null
    return Math.floor(articleTop + ((readableEnd - articleTop) * 0.65))
  })
  test.skip(targetScrollY === null, 'Article is not tall enough to exercise reading progress.')

  await scrollToAndSettle(page, targetScrollY!)
  await expect.poll(async () => Number(await progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)

  await expect(readingNav.getByRole('link', { name: '문장군 블로그 홈' })).toHaveAttribute('href', '/blog')
  await expect(readingNav.getByRole('button', { name: '블로그 검색 열기' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('blog article keeps reading progress available on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openFirstBlogPost(page)

  const readingNav = page.getByTestId('blog-navigation')
  const progressbar = readingNav.getByRole('progressbar', { name: '글 읽기 진행률' })
  await expect(readingNav).toBeVisible()
  await expect(progressbar).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByTestId('blog-mobile-bottom-actions')).toBeHidden()

  const targetScrollY = await page.evaluate(() => {
    const article = document.getElementById('blog-article')
    if (!article) return null
    const articleTop = article.getBoundingClientRect().top + window.scrollY
    const articleBottom = articleTop + article.offsetHeight
    const readableEnd = articleBottom - window.innerHeight
    if (readableEnd <= articleTop) return null
    return Math.floor(articleTop + ((readableEnd - articleTop) * 0.65))
  })
  test.skip(targetScrollY === null, 'Article is not tall enough to exercise reading progress.')

  await scrollToAndSettle(page, targetScrollY!)
  await expect.poll(async () => Number(await progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)

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
