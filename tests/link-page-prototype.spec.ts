import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/link-pages')
  await page.getByRole('button', { name: '예시 복구' }).click()
})

test('approved blocks use one live editor with immutable drag and copy ids', async ({ page }) => {
  await page.getByRole('button', { name: '+블럭 추가' }).click()
  await expect(page.locator('[data-block-picker-kind]')).toHaveCount(6)
  await expect(page.locator('[data-block-picker-kind="profile"]')).toHaveCount(0)
  await page.getByRole('dialog', { name: '블럭 추가' }).getByRole('button', { name: '닫기' }).click()

  const single = page.locator('[data-block-kind="singleLink"]')
  const text = page.locator('[data-block-kind="text"]')
  const singleId = await single.getAttribute('data-block-id')
  const textId = await text.getAttribute('data-block-id')

  await text.getByTitle('드래그해 정렬').dragTo(single.getByTitle('드래그해 정렬'))
  const orderedKinds = await page.locator('[data-block-kind]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-block-kind')))
  expect(orderedKinds).toEqual(['profile', 'text', 'singleLink'])
  expect(await page.locator(`[data-block-id="${singleId}"]`).getAttribute('data-block-kind')).toBe('singleLink')
  expect(await page.locator(`[data-block-id="${textId}"]`).getAttribute('data-block-kind')).toBe('text')

  await text.getByRole('button', { name: '블록 더보기' }).click()
  await text.getByRole('menuitem', { name: '블록 복사' }).click()
  const textCards = page.locator('[data-block-kind="text"]')
  await expect(textCards).toHaveCount(2)
  const copiedIds = await textCards.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-block-id')))
  expect(new Set(copiedIds).size).toBe(2)
  expect(copiedIds).toContain(textId)
})

test('group links keep required drafts out of state and render completed prices', async ({ page }) => {
  test.setTimeout(45_000)
  await page.getByRole('button', { name: '+블럭 추가' }).click()
  await page.locator('[data-block-picker-kind="groupLink"]').click()
  const group = page.locator('[data-block-kind="groupLink"]')
  await group.getByRole('button', { name: '펼치기' }).click()
  await group.getByRole('button', { name: '+ 링크 추가' }).click()

  const dialog = page.getByRole('dialog', { name: '그룹 링크 편집' })
  const save = dialog.getByRole('button', { name: '설정 완료' })
  await expect(save).toBeDisabled()
  await dialog.getByLabel('대표문구 *').fill('아직 URL 없음')
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'link.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(save).toBeDisabled()
  await dialog.getByLabel('연결 URL *').fill('https://example.com/product')
  await dialog.getByLabel('대표문구 *').fill('완성 링크')
  await dialog.getByLabel('판매가').fill('550,000원')
  await dialog.getByLabel('정가').fill('700,000원')
  await expect(save).toBeEnabled()
  await save.click()
  const preview = page.getByRole('region', { name: '실시간 미리보기' })
  await expect(preview.getByText('완성 링크')).toBeVisible()
  await expect(preview.getByText('550,000원')).toBeVisible()
  await expect(preview.getByText('700,000원')).toBeVisible()
})

test('deep tree, flat direct URLs, slug aliases, events, and 390px layout remain intact', async ({ page }) => {
  test.setTimeout(75_000)
  await page.getByRole('button', { name: '페이지 추가' }).first().click()
  await page.getByRole('textbox', { name: '페이지 이름' }).fill('3단계 상세 자료')
  await page.locator('input[name="slug"]').fill('level-three')
  await page.getByRole('combobox', { name: /상위 페이지/ }).selectOption({ label: '— 중문 상담 자료' })
  await page.getByRole('button', { name: '설정 완료' }).click()

  await expect(page.getByRole('link', { name: '/l/level-three' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '자료 페이지' }).getByRole('link')).toHaveCount(3)

  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await expect(page.getByRole('combobox', { name: /상위 페이지/ }).locator('option')).toHaveCount(1)
  await page.getByRole('button', { name: '취소' }).click()

  await page.goto('/l/level-three')
  await expect(page.getByRole('heading', { name: '3단계 상세 자료' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.getByRole('link', { name: '홈화면' }).click()
  await expect(page).toHaveURL(/\/l\/munjanggun$/)
  const viewedPageIds = await page.evaluate(() => {
    const events = JSON.parse(localStorage.getItem('munjanggun:link-page-events:v1') ?? '[]') as Array<{ type: string; pageId: string }>
    return [...new Set(events.filter((event) => event.type === 'page_view').map((event) => event.pageId))]
  })
  expect(viewedPageIds.length).toBeGreaterThanOrEqual(2)

  await page.goto('/link-pages')
  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await page.locator('input[name="slug"]').fill('munjanggun-new')
  await page.getByRole('button', { name: '설정 완료' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.slug)).toBe('munjanggun-new')
  await page.goto('/l/munjanggun')
  await expect(page).toHaveURL(/\/l\/munjanggun-new$/)

  await page.goto('/link-pages')
  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await page.locator('input[name="slug"]').fill('munjanggun')
  await page.getByRole('button', { name: '설정 완료' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.slug)).toBe('munjanggun')
  await page.reload()
  await expect(page.getByRole('button', { name: '문장군 상담 편집' })).toBeVisible()
  await expect(page.getByRole('button', { name: '3단계 상세 자료 편집' })).toBeVisible()
})
