import { expect, test, type Page } from '@playwright/test'

type ReaderMockOptions = {
  authenticated?: boolean
}

function readerPayload(liked: boolean, authenticated: boolean) {
  return {
    counts: { likes: liked ? 1 : 0 },
    viewer: authenticated
      ? { isAuthenticated: true, liked, privateQuestionCount: 0 }
      : null,
  }
}

async function mockReader(page: Page, { authenticated = true }: ReaderMockOptions = {}) {
  let liked = false
  let viewRequests = 0
  const patchBodies: Array<{ liked: boolean }> = []

  await page.route('**/api/blog/posts/*/reader/view', route => {
    viewRequests += 1
    return route.fulfill({ status: authenticated ? 204 : 401 })
  })
  await page.route('**/api/blog/posts/*/reader', async route => {
    const method = route.request().method()

    if (method === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(readerPayload(liked, authenticated)) })
    }

    if (method === 'PATCH') {
      if (!authenticated) return route.fulfill({ status: 401 })
      const body = route.request().postDataJSON() as { liked: boolean }
      patchBodies.push(body)
      liked = body.liked
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(readerPayload(liked, true)) })
    }

    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(readerPayload(liked, authenticated)) })
  })

  return {
    patchBodies: () => patchBodies,
    viewRequests: () => viewRequests,
  }
}

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
      .filter(key => key.startsWith('munjanggun:blog-question-draft:'))
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
  const reader = await mockReader(page)
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
  await expect(actions.getByRole('button', { name: '좋아요' })).toBeVisible()

  const questionLink = actions.getByRole('link', { name: /무료 방문실측 상담/ })
  await expect(questionLink).toBeVisible()
  const encodedPostSlug = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)
  const currentPostSlug = encodedPostSlug ? decodeURIComponent(encodedPostSlug) : null
  expect(currentPostSlug).toBeTruthy()
  await expect(questionLink).toHaveAttribute(
    'href',
    `/portal/measure/new?source=blog-question&post=${encodeURIComponent(currentPostSlug!)}`,
  )

  const genericCtaHrefs = await page.locator('aside[class*="ctaBlock"] a').evaluateAll(anchors => (
    anchors.map(anchor => anchor.getAttribute('href'))
  ))
  expect(genericCtaHrefs.length).toBeGreaterThan(0)
  expect([...new Set(genericCtaHrefs)]).toEqual(['/measure'])

  await expect(page.getByTestId('blog-question-panel')).toBeVisible()
  await expect(page.getByTestId('blog-question-panel')).toContainText('비공개 질문')
  await expect(page.getByTestId('blog-question-panel')).toContainText('개인정보를 적지 마세요')
  await expect.poll(reader.viewRequests, { timeout: 6_500 }).toBe(1)
})

test('blog article exposes current-article reading progress on mobile', async ({ page }) => {
  await mockReader(page)
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
  await mockReader(page)
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

test('blog article likes toggle through the reader API', async ({ page }) => {
  const reader = await mockReader(page)
  await openFirstBlogPost(page)

  const actions = page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })
  const like = actions.getByTestId('blog-like-action')
  await expect(like).toBeEnabled()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  expect(reader.patchBodies()).toEqual([{ liked: true }, { liked: false }])
})

test('blog article asks unauthenticated readers to log in instead of writing browser state', async ({ page }) => {
  await mockReader(page, { authenticated: false })
  await openFirstBlogPost(page)

  await page.getByTestId('blog-like-action').click()
  await expect(page.getByRole('status')).toContainText('로그인하면 좋아요와 비공개 질문을 마이페이지에 남길 수 있어요.')
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter(key => key.startsWith('munjanggun:blog-')))).toEqual([])
})

test('blog article actions do not create mobile horizontal overflow', async ({ page }) => {
  await mockReader(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await openFirstBlogPost(page)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('blog article exposes a mobile bottom action bar', async ({ page }) => {
  await mockReader(page)
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
  await expect(page.getByTestId('blog-mobile-like')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('blog-mobile-question')).toHaveAttribute('href', '#blog-question-panel')
  await expect(page.getByTestId('blog-mobile-measure')).toHaveAttribute('href', /\/portal\/measure\/new\?source=blog-question&post=/)

  await expect(page.getByTestId('blog-mobile-like')).toBeEnabled()
  await page.getByTestId('blog-mobile-like').click()
  await expect(page.getByTestId('blog-mobile-like')).toHaveAttribute('aria-pressed', 'true')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const finalCta = page.locator('aside a[href="/measure"]').last()
  await expect(finalCta).toBeVisible()
  const geometry = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="blog-mobile-bottom-actions"]')
    const cta = [...document.querySelectorAll('aside a[href="/measure"]')].at(-1)
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
