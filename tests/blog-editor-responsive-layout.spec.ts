import { expect, test, type Page } from '@playwright/test'

const editorPath = process.env.PLAYWRIGHT_BLOG_EDITOR_PATH

async function openEditor(page: Page) {
  const loginParams = new URLSearchParams({
    role: 'administrator',
    next: editorPath ?? '/admin/platform/blog',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) {
    loginParams.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)
  }
  await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  await page.goto(editorPath ?? '/admin/platform/blog', { waitUntil: 'networkidle' })

  test.skip(
    new URL(page.url()).pathname === '/admin/login',
    'An authenticated administrator session is required for responsive editor checks.',
  )

  if (!editorPath) {
    const discoveredPath = await page.locator('a[href^="/admin/platform/blog/"]').evaluateAll((links) => links
      .map(link => link.getAttribute('href'))
      .find(href => /^\/admin\/platform\/blog\/[0-9a-f-]{36}$/.test(href ?? '')) ?? null)

    expect(discoveredPath, 'An authenticated blog editor record is required for layout checks.').not.toBeNull()
    await page.goto(discoveredPath!, { waitUntil: 'domcontentloaded' })
  }

  await expect(page.getByTestId('blog-writing-canvas')).toBeVisible()
}

test('desktop editor keeps the manuscript title readable beside the preview rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openEditor(page)

  const title = page.getByTestId('blog-editor-title')
  const titleMetrics = await title.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return {
      width: element.getBoundingClientRect().width,
      lineCount: range.getClientRects().length,
    }
  })

  expect(titleMetrics.width).toBeGreaterThanOrEqual(280)
  expect(titleMetrics.lineCount).toBeLessThanOrEqual(4)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('mobile editor keeps the closed admin sidebar out of the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openEditor(page)

  const menuButton = page.getByRole('button', { name: '메뉴 열기' })
  const sidebar = page.locator('#admin-sidebar')
  const adminMain = page.getByRole('main').first()

  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebar).toBeHidden()
  expect(await adminMain.evaluate(element => (element as HTMLElement).inert)).toBe(false)

  await menuButton.press('Enter')
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar).toBeVisible()
  const closeButton = page.getByRole('button', { name: '메뉴 닫기' })
  await expect(closeButton).toBeFocused()
  expect(await adminMain.evaluate(element => (element as HTMLElement).inert)).toBe(true)

  await page.keyboard.press('Escape')
  await expect(sidebar).toBeHidden()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toBeFocused()
  expect(await adminMain.evaluate(element => (element as HTMLElement).inert)).toBe(false)
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)

  const sidebarState = await sidebar.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      visibility: getComputedStyle(element).visibility,
      right: rect.right,
    }
  })
  expect(sidebarState.visibility).toBe('hidden')
  expect(sidebarState.right).toBeLessThanOrEqual(0)
  expect(await sidebar.locator('a, button').evaluateAll(elements => elements.every((element) => (
    element.getBoundingClientRect().right <= 0
  )))).toBe(true)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
