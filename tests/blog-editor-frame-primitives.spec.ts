import { expect, test, type Page } from '@playwright/test'

const configuredEditorPath = process.env.PLAYWRIGHT_BLOG_EDITOR_PATH

async function openEditor(page: Page) {
  const loginParams = new URLSearchParams({
    role: 'administrator',
    next: configuredEditorPath ?? '/admin/platform/blog',
  })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) loginParams.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)

  await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  await page.goto(configuredEditorPath ?? '/admin/platform/blog', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')

  if (!configuredEditorPath) {
    const editorPath = await page.locator('a[href^="/admin/platform/blog/"]').evaluateAll(links => links
      .map(link => link.getAttribute('href'))
      .find(href => /^\/admin\/platform\/blog\/[0-9a-f-]{36}$/.test(href ?? '')) ?? null)
    expect(editorPath, 'an authenticated blog editor record is required').not.toBeNull()
    await page.goto(editorPath!, { waitUntil: 'networkidle' })
  }

  await expect(page.getByTestId('blog-writing-canvas')).toBeVisible()
}

test('editor tabs expose selected panels and keyboard navigation beside the preview frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openEditor(page)

  const tabList = page.getByRole('tablist', { name: '편집 모드' })
  const writeTab = tabList.getByRole('tab', { name: '작성란' })
  const seoTab = tabList.getByRole('tab', { name: 'SEO/AEO' })
  const writePanel = page.locator('#blog-editor-mode-panel-write')
  const seoPanel = page.locator('#blog-editor-mode-panel-seo')

  await expect(writeTab).toHaveAttribute('aria-selected', 'true')
  await expect(writeTab).toHaveAttribute('tabindex', '0')
  await expect(seoTab).toHaveAttribute('tabindex', '-1')
  await expect(writePanel).toBeVisible()
  await expect(seoPanel).toBeHidden()

  await writeTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(seoTab).toBeFocused()
  await expect(seoTab).toHaveAttribute('aria-selected', 'true')
  await expect(seoPanel).toBeVisible()
  await expect(writePanel).toBeHidden()

  await page.waitForTimeout(250)
  const selectedBeforeHover = await seoTab.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color, border: style.borderColor }
  })
  await seoTab.hover()
  const selectedAfterHover = await seoTab.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color, border: style.borderColor }
  })
  expect(selectedAfterHover).toEqual(selectedBeforeHover)

  await page.keyboard.press('Home')
  await expect(writeTab).toBeFocused()
  await page.keyboard.press('End')
  await expect(seoTab).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(writeTab).toBeFocused()

  const previewFrame = page.getByTestId('blog-editor-preview-frame')
  await expect(previewFrame).toBeVisible()
  const frameBox = await previewFrame.boundingBox()
  expect(frameBox).not.toBeNull()
  expect(Math.abs((frameBox!.width / frameBox!.height) - (390 / 844))).toBeLessThan(0.02)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('editor tabs and preview frame fit 390px with focus and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEditor(page)

  const writeTab = page.getByRole('tab', { name: '작성란' })
  const tabBounds = await writeTab.boundingBox()
  expect(tabBounds?.height).toBeGreaterThanOrEqual(44)
  await writeTab.focus()
  expect(await writeTab.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  expect(await writeTab.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001)

  const previewFrame = page.getByTestId('blog-editor-preview-frame')
  const frameBounds = await previewFrame.boundingBox()
  expect(frameBounds?.width).toBeLessThanOrEqual(390)
  const mobilePreviewBounds = await previewFrame.evaluate(element => {
    const frame = element.getBoundingClientRect()
    const dock = element.parentElement?.getBoundingClientRect()
    return dock ? {
      frameBottom: frame.bottom,
      frameHeight: frame.height,
      dockBottom: dock.bottom,
      dockHeight: dock.height,
    } : null
  })
  expect(mobilePreviewBounds).not.toBeNull()
  expect(mobilePreviewBounds!.frameBottom).toBeLessThanOrEqual(mobilePreviewBounds!.dockBottom + 1)
  expect(mobilePreviewBounds!.frameHeight).toBeLessThanOrEqual(mobilePreviewBounds!.dockHeight)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
})
