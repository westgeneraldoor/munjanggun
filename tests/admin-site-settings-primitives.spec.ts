import { expect, test } from '@playwright/test'

const fixtureUrl = '/test-fixtures/admin-site-settings'

test('saves settings through one RPC and preserves input after a failed save', async ({ page }) => {
  let shouldFail = true
  const rpcBodies: unknown[] = []
  const directTableWrites: string[] = []

  await page.route('**/rest/v1/**', async route => {
    const request = route.request()
    const url = request.url()

    if (url.includes('/rpc/save_site_settings')) {
      rpcBodies.push(request.postDataJSON())
      await new Promise(resolve => setTimeout(resolve, 250))
      if (shouldFail) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'P0001', message: '검증된 저장 실패' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ media_count: 0 }),
        })
      }
      return
    }

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
      directTableWrites.push(`${request.method()} ${url}`)
    }
    await route.abort()
  })

  await page.goto(fixtureUrl)
  await page.getByRole('button', { name: '이미지 삭제' }).click()
  await expect(page.getByRole('heading', { name: '슬라이드 1' })).toHaveCount(0)
  const title = page.getByLabel('사이트 제목')
  await title.fill('수정 중인 쇼룸 제목')

  const save = page.locator('button[type="submit"]')
  await save.click()
  await expect(save).toHaveAttribute('aria-busy', 'true')
  await expect(title).toBeDisabled()
  await expect(page.getByRole('alert').filter({ hasText: '설정을 저장하지 못했습니다' })).toContainText('검증된 저장 실패')
  await expect(title).toHaveValue('수정 중인 쇼룸 제목')

  shouldFail = false
  await save.click()
  const savedStatus = page.getByRole('status').filter({ hasText: '설정을 저장했습니다' })
  await expect(savedStatus).toBeVisible()
  await title.fill('다시 수정한 쇼룸 제목')
  await expect(savedStatus).toHaveCount(0)

  expect(rpcBodies).toHaveLength(2)
  expect(rpcBodies[1]).toMatchObject({
    p_settings: { site_title: '수정 중인 쇼룸 제목' },
    p_media: [],
  })
  expect(directTableWrites).toEqual([])
})

test('keeps shared controls accessible and usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixtureUrl)
  await page.getByRole('button', { name: '이미지 삭제' }).click()

  const desktopImages = page.getByRole('button', { name: /데스크탑 이미지/ })
  await desktopImages.focus()
  await desktopImages.press('Enter')
  await expect(desktopImages).toHaveAttribute('aria-expanded', 'false')
  await desktopImages.press('Space')
  await expect(desktopImages).toHaveAttribute('aria-expanded', 'true')

  await expect(page.getByLabel('데스크탑 영상 URL')).toBeVisible()
  await expect(page.getByLabel('모바일 영상 URL')).toBeVisible()
  const emptyUploader = page.getByRole('button', { name: /클릭하거나 파일을 여기로 드래그하세요/ }).first()
  await expect(emptyUploader).toBeVisible()
  expect((await emptyUploader.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  for (const control of [
    page.getByLabel('사이트 제목'),
    page.getByLabel('사이트 설명 (SEO)'),
    page.getByLabel('메인 페이지 카드 표시 방식'),
    page.getByRole('switch', { name: '히어로 사용' }),
    page.getByRole('button', { name: '설정 저장' }),
  ]) {
    const box = await control.boundingBox()
    expect(box, 'control must be visible').not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  await page.getByLabel('사이트 제목').focus()
  await expect(page.getByLabel('사이트 제목')).toBeFocused()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page).toHaveScreenshot('admin-site-settings-390.png', { fullPage: true })
})
