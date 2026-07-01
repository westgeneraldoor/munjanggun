import { expect, test, type Page } from '@playwright/test'

async function openFirstBlogPost(page: Page) {
  await page.goto('/blog')

  const firstPostLink = page.locator('main a[href^="/blog/"]').first()
  if (await firstPostLink.count() === 0) {
    test.skip(true, 'No published blog post is available in this environment.')
  }
  await expect(firstPostLink).toBeVisible()

  const href = await firstPostLink.getAttribute('href')
  expect(href).toMatch(/^\/blog\/[^/]+$/)

  await page.goto(href!)
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
  })
  await openFirstBlogPost(page)

  const actions = page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })
  await expect(actions).toBeVisible()

  await actions.getByRole('button', { name: '공유하기' }).click()
  await expect(actions.getByText('링크를 복사했어요.')).toBeVisible()
  await expect(actions.getByRole('button', { name: '도움돼요' })).toBeVisible()

  const questionLink = actions.getByRole('link', { name: /무료 방문실측 상담/ })
  await expect(questionLink).toBeVisible()
  await expect(questionLink).toHaveAttribute('href', '/portal/measure/new')
})

test('helpful action stays local to the article', async ({ page }) => {
  await openFirstBlogPost(page)

  const actions = page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' })
  await actions.getByRole('button', { name: '도움돼요' }).click()
  await expect(actions.getByText('도움 표시를 저장했어요.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('region', { name: '글을 읽은 뒤 할 수 있는 일' }).getByText('도움 표시를 저장했어요.')).toBeVisible()
})

test('blog article actions do not create mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await openFirstBlogPost(page)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
