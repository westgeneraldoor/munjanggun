import { expect, test, type Page } from '@playwright/test'

const DETAIL_PATH = '/middle-door/3panel/collection-3panel/basic-3panel/full-window'
const OPTIMIZER_PATTERN = /\/_(?:next|vercel)\/image(?:\?|$)/

async function scrollThrough(page: Page) {
  // The descendant gallery can extend the document while scrolling. Use a
  // bounded number of real bottom reaches so the image contract remains
  // deterministic instead of chasing a height that changes underneath it.
  for (let pass = 0; pass < 3; pass += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(450)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
}

async function expectHealthyImages(page: Page, optimizerRequests: string[]) {
  const snapshot = () => page.evaluate(() => {
    const visibleImages = Array.from(document.images).filter(image => {
      const style = getComputedStyle(image)
      const rect = image.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.top < window.innerHeight
    })
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      imageCount: visibleImages.length,
      pendingImages: visibleImages
        .filter(image => !image.complete)
        .map(image => image.currentSrc || image.src),
      brokenImages: visibleImages
        .filter(image => image.complete && image.naturalWidth === 0)
        .map(image => image.currentSrc || image.src),
    }
  })
  await expect.poll(snapshot, { timeout: 15_000 }).toMatchObject({ pendingImages: [], brokenImages: [] })
  const result = await snapshot()

  expect(result.imageCount).toBeGreaterThan(0)
  expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth)
  expect(optimizerRequests).toEqual([])
}

for (const viewport of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`stored showroom images stay direct and healthy on ${viewport.name}`, async ({ page }) => {
    const optimizerRequests: string[] = []
    const consoleErrors: string[] = []
    page.on('request', request => {
      if (OPTIMIZER_PATTERN.test(request.url())) optimizerRequests.push(request.url())
    })
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/middle-door', { waitUntil: 'load' })
    await expect(page.locator('img[data-showroom-image-purpose="card"]').first()).toBeVisible()
    await scrollThrough(page)
    await expectHealthyImages(page, optimizerRequests)

    await page.goto(DETAIL_PATH, { waitUntil: 'load' })
    await scrollThrough(page)
    await expectHealthyImages(page, optimizerRequests)

    const firstGalleryImage = page.getByRole('img', { name: /갤러리 사진 1$/ })
    await firstGalleryImage.click()
    await expect(page.locator('img[data-showroom-image-purpose="large"]')).toBeVisible()
    await expectHealthyImages(page, optimizerRequests)
    expect(consoleErrors).toEqual([])
  })
}
