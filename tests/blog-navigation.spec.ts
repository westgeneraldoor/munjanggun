import { expect, test, type Page } from '@playwright/test'

async function openBlog(page: Page) {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('blog-home-hero')).toBeVisible()
  await expect(page.getByTestId('blog-navigation')).toHaveAttribute('data-hydrated', 'true')
}

async function openFirstArticle(page: Page) {
  await openBlog(page)
  const articleLinks = page.locator('main a[href^="/blog/"]')
  const count = await articleLinks.count()
  test.skip(count === 0, 'No published blog article is available.')
  const href = await articleLinks.nth(0).getAttribute('href')
  await page.goto(href!, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#blog-article')).toBeVisible()
}

test('blog main uses one shared navigation with search and account access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const navigation = page.getByTestId('blog-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.locator('a[href="/portal/measure/new"]')).toHaveCount(0)
  await expect(page.locator('#blog-search')).toHaveCount(0)
  await expect(navigation.locator('a[href="#blog-topics"]')).toHaveCount(1)
  await expect(navigation.locator('a[href="#blog-story"]')).toHaveCount(1)
  await expect(navigation.locator('a[href="#blog-condition"]')).toHaveCount(1)
  await expect(navigation.locator('a[href="#blog-starter"]')).toHaveCount(0)

  const accountControls = navigation.locator('#public-login-link, #public-user-menu-toggle')
  await expect.poll(async () => accountControls.count()).toBe(1)

  await navigation.getByRole('button', { name: '블로그 검색 열기' }).click()
  const searchPanel = page.getByTestId('blog-navigation-search')
  await expect(searchPanel).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '블로그 글 검색' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(searchPanel).toBeHidden()
  await expect(navigation.getByRole('button', { name: '블로그 검색 열기' })).toBeFocused()
})

test('authenticated search and account menus stay mutually exclusive and keyboard friendly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const response = await page.goto('http://localhost:3000/api/dev/playwright-login?role=customer&next=/blog')

  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }
  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }

  await expect(page.getByTestId('blog-home-hero')).toBeVisible()
  const navigation = page.getByTestId('blog-navigation')
  const accountControls = navigation.locator('#public-login-link, #public-user-menu-toggle')
  await expect.poll(async () => accountControls.count()).toBe(1)
  test.skip(await navigation.locator('#public-user-menu-toggle').count() === 0, 'Authenticated blog menu is unavailable in this environment.')

  const accountToggle = navigation.getByRole('button', { name: '계정 메뉴 열기' })
  await expect(accountToggle).toBeVisible()

  await navigation.getByRole('button', { name: '블로그 검색 열기' }).click()
  await expect(page.getByTestId('blog-navigation-search')).toBeVisible()

  await accountToggle.click()
  await expect(page.getByTestId('blog-navigation-search')).toBeHidden()
  const accountMenu = page.getByRole('menu')
  await expect(accountMenu).toBeVisible()
  await expect(accountMenu.getByRole('menuitem', { name: '마이페이지' })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(accountMenu.getByRole('menuitem', { name: '무료방문견적 신청' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(accountMenu).toBeHidden()
  await expect(accountToggle).toBeFocused()
})

test('blog navigation search exposes published article results', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openBlog(page)

  const navigation = page.getByTestId('blog-navigation')
  const accountControls = navigation.locator('#public-login-link, #public-user-menu-toggle')
  await expect.poll(async () => accountControls.count()).toBe(1)
  await navigation.getByRole('button', { name: '블로그 검색 열기' }).click()
  const searchbox = page.getByRole('searchbox', { name: '블로그 글 검색' })
  await expect(searchbox).toBeVisible()
  await searchbox.fill('중문')

  const resultPanel = page.getByTestId('blog-navigation-results')
  await expect(resultPanel).toBeVisible()
  const resultLinks = resultPanel.locator('a[href^="/blog/"]')
  test.skip(await resultLinks.count() === 0, 'No matching published article is available.')
  const firstResult = resultLinks.nth(0)
  const href = await firstResult.getAttribute('href')
  await expect(firstResult).toBeVisible()
  await firstResult.click()
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
})

test('article route uses the same navigation and preserves reading progress', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openFirstArticle(page)

  const navigation = page.getByTestId('blog-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.locator('a[href="/portal/measure/new"]')).toHaveCount(0)
  await expect(navigation.getByRole('progressbar', { name: '글 읽기 진행률' })).toBeVisible()
  await expect(navigation.getByRole('button', { name: '블로그 검색 열기' })).toBeVisible()
})

test('mobile keeps search and account inside the fixed navigation', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await openBlog(page)

  const navigation = page.getByTestId('blog-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: '블로그 검색 열기' })).toBeVisible()
  const accountControls = navigation.locator('#public-login-link, #public-user-menu-toggle')
  await expect.poll(async () => accountControls.count()).toBe(1)

  const alignment = await navigation.evaluate(element => {
    const search = element.querySelector('button[aria-label="블로그 검색 열기"]')
    const account = element.querySelector('#public-login-link, #public-user-menu-toggle')
    if (!search || !account) return null
    const searchRect = search.getBoundingClientRect()
    const accountRect = account.getBoundingClientRect()
    return {
      verticalDelta: Math.abs(searchRect.top - accountRect.top),
      gap: accountRect.left - searchRect.right,
    }
  })
  expect(alignment?.verticalDelta).toBeLessThanOrEqual(1)
  expect(alignment?.gap).toBeGreaterThanOrEqual(4)

  await navigation.getByRole('button', { name: '블로그 검색 열기' }).click()
  await expect(page.getByTestId('blog-navigation-search')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
