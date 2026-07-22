import { expect, test } from '@playwright/test'

test('public blog renderer preserves and displays the animated GIF original', async ({ page, request }) => {
  const browserErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.route('**/api/blog/posts/public-gif-regression/reader', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ counts: { likes: 0 }, viewer: null }),
  }))
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/test-fixtures/blog-public-gif')

  await expect(page.getByRole('heading', { name: '공개 GIF 렌더링 회귀 검증' })).toBeVisible()
  const image = page.getByRole('img', { name: '문장군 베이직 제품 동작 예시' })
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute('src', '/test-fixtures/blog-public-gif/animated.gif')
  await expect(page.getByText('GIF 원본 애니메이션 검증용 캡션')).toBeVisible()

  expect(await image.evaluate((element: HTMLImageElement) => ({
    complete: element.complete,
    width: element.naturalWidth,
    height: element.naturalHeight,
    currentSrc: element.currentSrc,
  }))).toEqual(expect.objectContaining({ complete: true, width: 1, height: 1 }))
  expect(await image.evaluate((element: HTMLImageElement) => element.currentSrc.endsWith('/test-fixtures/blog-public-gif/animated.gif'))).toBe(true)

  const response = await request.get('/test-fixtures/blog-public-gif/animated.gif')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/gif')
  const bytes = await response.body()
  expect(bytes.subarray(0, 6).toString('ascii')).toBe('GIF89a')
  let frameControls = 0
  for (let index = 0; index <= bytes.length - 3; index += 1) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) frameControls += 1
  }
  expect(frameControls).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute('alt', '문장군 베이직 제품 동작 예시')
  await expect(image).toHaveAttribute('src', '/test-fixtures/blog-public-gif/animated.gif')
  await expect(page.getByText('GIF 원본 애니메이션 검증용 캡션')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  expect(browserErrors).toEqual([])
})
