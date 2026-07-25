import { expect, test } from '@playwright/test'

test('node save is atomic, retains failed edits, and remains usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const rpcBodies: unknown[] = []
  let rpcAttempt = 0
  let directTableWrites = 0
  let releaseUpload!: () => void
  const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve })

  await page.route('**/test-fixtures/admin-node-form', async route => {
    const request = route.request()
    if (request.method() === 'POST' && request.headers()['next-action']) {
      await uploadGate
    }
    await route.continue()
  })

  await page.route('**/rest/v1/**', async route => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    if (/\/(?:nodes|hero_media|gallery_photos)(?:\?|$)/.test(url) && method !== 'GET' && method !== 'HEAD') {
      directTableWrites += 1
    }

    if (url.includes('/rpc/save_node') && method === 'POST') {
      rpcAttempt += 1
      rpcBodies.push(request.postDataJSON())
      if (rpcAttempt === 1) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'P0001', message: 'fixture rollback' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ node_id: '11111111-1111-4111-8111-111111111111', hero_media_count: 0, gallery_photo_count: 1 }),
        })
      }
      return
    }

    if (url.includes('/preview_tokens')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/test-fixtures/admin-node-form', { waitUntil: 'networkidle' })

  const name = page.getByLabel('노드 이름 *')
  await name.fill('실패 후에도 남는 이름')
  const save = page.getByRole('button', { name: '저장' })
  const saveBox = await save.boundingBox()
  expect(saveBox?.height).toBeGreaterThanOrEqual(44)

  await page.getByLabel('이미지 파일 선택').first().setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(save).toBeDisabled()
  await expect(page.getByRole('button', { name: '리스트(listing) 노드로 전환' })).toBeDisabled()
  expect(rpcAttempt).toBe(0)
  releaseUpload()
  await expect(save).toBeEnabled({ timeout: 8_000 })

  await save.click()
  await expect(page.getByRole('alert').filter({ hasText: 'fixture rollback' })).toBeVisible()
  await expect(name).toHaveValue('실패 후에도 남는 이름')

  await save.click()
  await expect(page.getByRole('status').filter({ hasText: '저장되었습니다' })).toBeVisible()
  await expect(name).toHaveValue('실패 후에도 남는 이름')

  expect(rpcAttempt).toBe(2)
  expect(directTableWrites).toBe(0)
  expect(rpcBodies[1]).toMatchObject({
    p_node_id: '11111111-1111-4111-8111-111111111111',
    p_node: { name: '실패 후에도 남는 이름', type: 'detail' },
    p_hero_media: [{ image_url: 'https://example.com/hero.jpg', device_type: 'desktop', media_type: 'image', display_order: 0 }],
    p_gallery_photos: [{ image_url: 'https://example.com/gallery.jpg', caption: '샘플', display_order: 0 }],
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
})
