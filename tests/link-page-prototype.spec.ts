import { expect, test } from '@playwright/test'

const V1_FIXTURE = {
  rootPageId: '7f6a220a-4ca8-48c3-9bca-0fcf43f0e101',
  childPageId: '7f6a220a-4ca8-48c3-9bca-0fcf43f0e102',
  secondNavigationId: '7f6a220a-4ca8-48c3-9bca-0fcf43f0e103',
  rootBlockIds: [
    '03bb653b-b556-47ba-8b55-6a654f9b1011',
    '03bb653b-b556-47ba-8b55-6a654f9b1012',
    '03bb653b-b556-47ba-8b55-6a654f9b1013',
  ],
  childGalleryItemIds: [
    '151b36a7-cdf0-4c83-a6d0-f98341130101',
    '151b36a7-cdf0-4c83-a6d0-f98341130102',
  ],
  assetId: '0bc8e422-5f29-45e0-b335-844f94bb2101',
}

async function writeV1Fixture(page: import('@playwright/test').Page) {
  await page.evaluate((fixture) => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const root = state.pages.find((candidate: { id: string }) => candidate.id === fixture.rootPageId)
    const child = state.pages.find((candidate: { id: string }) => candidate.id === fixture.childPageId)
    if (!root || !child) throw new Error('expected prototype seed pages')

    root.title = '첫 네비게이션'
    root.slug = 'nav-root'
    root.slugAliases = ['nav-root-old']
    root.sortOrder = 0
    root.blocks[1].content.image = {
      id: fixture.assetId,
      name: 'migration-fixture.png',
      type: 'image/png',
      size: 68,
    }
    child.title = '자식 전용 자료'
    child.slug = 'child-page'
    child.parentId = root.id
    child.sortOrder = 0

    const secondNavigation = structuredClone(root)
    secondNavigation.id = fixture.secondNavigationId
    secondNavigation.title = '두 번째 네비게이션'
    secondNavigation.slug = 'nav-second'
    secondNavigation.slugAliases = []
    secondNavigation.parentId = null
    secondNavigation.sortOrder = 1
    secondNavigation.blocks = secondNavigation.blocks.map((block: { id: string; pageId: string }, index: number) => ({
      ...block,
      id: `03bb653b-b556-47ba-8b55-6a654f9b103${index + 1}`,
      pageId: fixture.secondNavigationId,
    }))

    state.version = 1
    state.pages = [root, child, secondNavigation]
    state.selectedPageId = root.id
    localStorage.setItem(key, JSON.stringify(state))
  }, V1_FIXTURE)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/link-pages')
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()
  await page.getByRole('button', { name: '예시 복구' }).click()
  await page.getByRole('dialog', { name: '예시 데이터로 초기화할까요?' }).getByRole('button', { name: '초기화' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').version)).toBe(2)
  await page.waitForTimeout(250)
})

test('page creation asks for navigation or child before page details', async ({ page }) => {
  await page.getByRole('button', { name: '페이지 추가' }).first().click()

  await expect(page.getByRole('button', { name: '네비게이션 페이지' })).toBeVisible()
  await expect(page.getByRole('button', { name: '자식 페이지' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '페이지 이름' })).toHaveCount(0)

  await page.getByRole('button', { name: '네비게이션 페이지' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 이름' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /상위 페이지/ })).toHaveCount(0)
})

test('child creation requires an explicit parent', async ({ page }) => {
  await page.getByRole('button', { name: '페이지 추가' }).first().click()
  await page.getByRole('button', { name: '자식 페이지' }).click()

  const parent = page.getByRole('combobox', { name: /상위 페이지/ })
  await expect(parent).toBeVisible()
  await expect(parent).toHaveAttribute('required', '')
  await expect(parent.locator('option')).toHaveCount(3)
})

test('child pages never leak into the public top navigation', async ({ page }) => {
  await writeV1Fixture(page)
  await page.reload()
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()
  await page.goto('/l/nav-root')

  const navigation = page.getByRole('navigation', { name: '자료 페이지' })
  await expect(navigation.getByRole('link')).toHaveCount(2)
  await expect(navigation.getByRole('link', { name: '첫 네비게이션' })).toBeVisible()
  await expect(navigation.getByRole('link', { name: '두 번째 네비게이션' })).toBeVisible()
  await expect(navigation.getByRole('link', { name: '자식 전용 자료' })).toHaveCount(0)
})

test('each page can hide its public top navigation without changing sibling pages', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.length ?? 0)).toBeGreaterThan(0)
  await writeV1Fixture(page)
  await page.reload()
  await page.getByRole('button', { name: '디자인' }).click()

  const visibility = page.getByRole('checkbox', { name: '상단 메뉴 표시' })
  await expect(visibility).toBeChecked()
  await visibility.uncheck()
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    return state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)?.theme.showNavigation
  })).toBe(false)

  await page.goto('/l/nav-root')
  await expect(page.getByRole('navigation', { name: '자료 페이지' })).toHaveCount(0)

  await page.goto('/l/nav-second')
  const siblingNavigation = page.getByRole('navigation', { name: '자료 페이지' })
  await expect(siblingNavigation.getByRole('link')).toHaveCount(2)
})

test('internal page destinations follow the target canonical slug', async ({ page }) => {
  test.setTimeout(60_000)
  await writeV1Fixture(page)
  await page.reload()
  await page.goto('/l/nav-root')
  await page.evaluate((targetPageId) => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const source = state.pages.find((candidate: { slug: string }) => candidate.slug === 'nav-root')
    const singleLink = source.blocks.find((block: { kind: string }) => block.kind === 'singleLink')
    singleLink.content.title = '내부 대상 페이지'
    singleLink.content.destination = { kind: 'page', pageId: targetPageId }
    delete singleLink.content.url
    localStorage.setItem(key, JSON.stringify(state))
  }, V1_FIXTURE.childPageId)
  await page.reload()

  const internalLink = page.getByRole('link', { name: /내부 대상 페이지/ })
  await expect(internalLink).toHaveAttribute('href', '/l/child-page')
  await expect(internalLink).not.toHaveAttribute('target', '_blank')

  await page.evaluate((targetPageId) => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const target = state.pages.find((candidate: { id: string }) => candidate.id === targetPageId)
    target.slugAliases = [...target.slugAliases, target.slug]
    target.slug = 'child-page-renamed'
    localStorage.setItem(key, JSON.stringify(state))
  }, V1_FIXTURE.childPageId)
  await page.reload()

  await expect(internalLink).toHaveAttribute('href', '/l/child-page-renamed')
})

test('gallery images can switch between external links and internal pages', async ({ page }) => {
  await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.selectedPageId = state.pages.find((candidate: { role: string }) => candidate.role === 'child').id
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()

  const gallery = page.locator('[data-block-kind="gallery"]')
  await gallery.getByRole('button', { name: '펼치기' }).click()
  const firstImage = gallery.locator('[data-item-id]').first()
  await firstImage.getByRole('button', { name: '이미지 연결 추가' }).click()
  await firstImage.getByLabel('연결 URL *').fill('https://example.com/gallery')
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    return selected.blocks.find((block: { kind: string }) => block.kind === 'gallery').content.items[0].destination
  })).toEqual({ kind: 'external', url: 'https://example.com/gallery' })

  await firstImage.getByRole('radio', { name: '내부 페이지' }).click()
  await firstImage.getByLabel('이동할 페이지').selectOption({ label: '문장군 상담' })
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    return selected.blocks.find((block: { kind: string }) => block.kind === 'gallery').content.items[0].destination
  })).toEqual({ kind: 'page', pageId: V1_FIXTURE.rootPageId })

  await page.goto('/l/sliding-door')
  const internalImage = page.getByRole('link', { name: '중문 상담 자료 1' })
  await expect(internalImage).toHaveAttribute('href', '/l/munjanggun')
  await expect(internalImage).not.toHaveAttribute('target', '_blank')
})

test('external link metadata fills an untouched title and image suggestion', async ({ page }) => {
  await page.route('**/api/link-pages/metadata', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'found',
        title: '자동으로 찾은 표지',
        imageUrl: 'https://cdn.example.com/link-cover.jpg',
      }),
    })
  })

  await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    const singleLink = selected.blocks.find((block: { kind: string }) => block.kind === 'singleLink')
    singleLink.content.title = '새 링크'
    delete singleLink.content.imageUrl
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()

  const single = page.locator('[data-block-kind="singleLink"]')
  await single.getByRole('button', { name: '펼치기' }).click()
  await single.getByLabel('연결 URL *').fill('https://example.com/metadata-fixture')

  await expect(single.getByRole('status')).toContainText('표지 정보 후보를 불러왔어요')
  await expect(single.getByLabel('대표문구 *')).toHaveValue('자동으로 찾은 표지')
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    return selected.blocks.find((block: { kind: string }) => block.kind === 'singleLink')?.content.imageUrl
  })).toBe('https://cdn.example.com/link-cover.jpg')
})

test('highlighted single links have no default border or outline', async ({ page }) => {
  await page.goto('/l/munjanggun')
  const link = page.getByRole('link', { name: /무료방문실측 견적상담/ })
  await expect(link).toBeVisible()
  await expect.poll(() => link.evaluate((element) => {
    const style = getComputedStyle(element)
    return `${style.borderTopWidth}/${style.borderTopStyle}/${style.outlineStyle}`
  })).toBe('0px/none/none')
})

test('design studio exposes the required Littly-derived sections', async ({ page }) => {
  await page.getByRole('button', { name: '디자인' }).click()

  for (const section of ['추천 테마', '배경', '버튼 색상', '버튼 모양', '버튼 액션', '타이포그래피', '상단 메뉴', '공유 및 구독', '로고']) {
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()
  }
})

test('recommended themes preserve locked background and support exact undo', async ({ page }) => {
  await page.getByRole('button', { name: '디자인' }).click()
  await page.getByRole('checkbox', { name: '배경 잠금' }).check()

  const before = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    return {
      theme: selected.theme,
      ids: state.pages.map((candidate: { id: string; blocks: Array<{ id: string }> }) => ({
        pageId: candidate.id,
        blockIds: candidate.blocks.map((block) => block.id),
      })),
    }
  })

  await page.getByRole('button', { name: '추천 테마 적용' }).click()
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    return state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)?.theme
  })).not.toEqual(before.theme)

  const after = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const selected = state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)
    return {
      theme: selected.theme,
      ids: state.pages.map((candidate: { id: string; blocks: Array<{ id: string }> }) => ({
        pageId: candidate.id,
        blockIds: candidate.blocks.map((block) => block.id),
      })),
    }
  })
  expect(after.theme.backgroundColor).toBe(before.theme.backgroundColor)
  expect(after.ids).toEqual(before.ids)

  await page.getByRole('button', { name: '이전 테마로 되돌리기' }).click()
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    return state.pages.find((candidate: { id: string }) => candidate.id === state.selectedPageId)?.theme
  })).toEqual(before.theme)
})

test('V1 state migrates to V2 without changing identifiers aliases or asset references', async ({ page }) => {
  await writeV1Fixture(page)
  await page.reload()
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}'))
  expect(migrated.version).toBe(2)
  expect(migrated.pages.map((candidate: { id: string }) => candidate.id)).toEqual([
    V1_FIXTURE.rootPageId,
    V1_FIXTURE.childPageId,
    V1_FIXTURE.secondNavigationId,
  ])
  expect(migrated.pages[0].slugAliases).toEqual(['nav-root-old'])
  expect(migrated.pages[0].blocks.slice(0, 3).map((block: { id: string }) => block.id)).toEqual(V1_FIXTURE.rootBlockIds)
  expect(migrated.pages[1].blocks[1].content.items.map((item: { id: string }) => item.id)).toEqual(V1_FIXTURE.childGalleryItemIds)
  expect(migrated.pages[0].blocks[1].content.image.id).toBe(V1_FIXTURE.assetId)
  expect(migrated.pages.every((candidate: { theme: { showNavigation?: boolean } }) => candidate.theme.showNavigation === true)).toBe(true)
})

test('existing V2 themes backfill navigation visibility without losing page data', async ({ page }) => {
  const before = await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    for (const candidate of state.pages) delete candidate.theme.showNavigation
    localStorage.setItem(key, JSON.stringify(state))
    return {
      selectedPageId: state.selectedPageId,
      pages: state.pages.map((candidate: { id: string; slug: string; blocks: Array<{ id: string }> }) => ({
        id: candidate.id,
        slug: candidate.slug,
        blockIds: candidate.blocks.map((block) => block.id),
      })),
    }
  })

  await page.reload()
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}'))
  expect(migrated.selectedPageId).toBe(before.selectedPageId)
  expect(migrated.pages.map((candidate: { id: string; slug: string; blocks: Array<{ id: string }> }) => ({
    id: candidate.id,
    slug: candidate.slug,
    blockIds: candidate.blocks.map((block) => block.id),
  }))).toEqual(before.pages)
  expect(migrated.pages.every((candidate: { theme: { showNavigation?: boolean } }) => candidate.theme.showNavigation === true)).toBe(true)
})

test('normal example reset preserves the current state until the user confirms', async ({ page }) => {
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    state.pages[0].title = '초기화 전 페이지'
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()
  await expect(page.getByRole('treeitem').filter({ hasText: '초기화 전 페이지' })).toBeVisible()

  await page.getByRole('button', { name: '예시 복구' }).click()
  const dialog = page.getByRole('dialog', { name: '예시 데이터로 초기화할까요?' })
  await expect(dialog).toContainText('현재 페이지와 편집 내용이 모두 삭제됩니다.')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.title)).toBe('초기화 전 페이지')

  await dialog.getByRole('button', { name: '초기화' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.title)).toBe('문장군 상담')
})

test('editor preserves unrecognized raw state and offers confirmed recovery', async ({ page }) => {
  const raw = '{"unexpected":"state"}'
  await page.waitForTimeout(250)
  await page.evaluate((value) => localStorage.setItem('munjanggun:link-pages:v1', value), raw)
  await page.reload()

  await expect(page.getByRole('heading', { name: '저장된 링크 페이지를 열 수 없어요.' })).toBeVisible()
  await expect(page.getByText('원본 데이터는 그대로 보존되어 있습니다.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('munjanggun:link-pages:v1'))).toBe(raw)

  await page.getByRole('button', { name: '예시 데이터로 초기화' }).click()
  expect(await page.evaluate(() => localStorage.getItem('munjanggun:link-pages:v1'))).toBe(raw)
  const dialog = page.getByRole('dialog', { name: '예시 데이터로 초기화할까요?' })
  await dialog.getByRole('button', { name: '초기화' }).click()

  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').version)).toBe(2)
})

test('public page reports a preserved repository load failure instead of hanging', async ({ page }) => {
  await page.waitForTimeout(250)
  await page.evaluate(() => localStorage.setItem('munjanggun:link-pages:v1', '{"unexpected":"state"}'))
  await page.goto('/l/munjanggun')

  await expect(page.getByRole('heading', { name: '페이지 데이터를 열 수 없어요.' })).toBeVisible()
  await expect(page.getByText('관리자에게 저장된 링크 페이지 데이터 확인을 요청해주세요.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('munjanggun:link-pages:v1'))).toBe('{"unexpected":"state"}')
})

test('page deletion is blocked while a UUID link still references the target', async ({ page }) => {
  await page.waitForTimeout(250)
  const targetId = await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const source = state.pages[0]
    const target = state.pages[1]
    const link = source.blocks.find((block: { kind: string }) => block.kind === 'singleLink')
    link.content.destination = { kind: 'page', pageId: target.id }
    link.content.url = ''
    state.selectedPageId = target.id
    localStorage.setItem(key, JSON.stringify(state))
    return target.id as string
  })
  await page.reload()

  const targetRow = page.getByRole('treeitem').filter({ hasText: '중문 상담 자료' })
  await targetRow.hover()
  await page.getByRole('button', { name: '중문 상담 자료 삭제' }).click()
  const dialog = page.getByRole('dialog', { name: '페이지를 삭제할 수 없어요.' })
  await expect(dialog).toContainText('문장군 상담')
  await expect(dialog).toContainText('단일 링크')
  await expect(dialog.getByRole('button', { name: '삭제' })).toHaveCount(0)
  await dialog.getByRole('button', { name: '확인' }).click()

  expect(await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    return state.pages.some((candidate: { id: string }) => candidate.id === id)
  }, targetId)).toBe(true)
})

test('deleting a navigation root promotes its direct children to valid navigation roots', async ({ page }) => {
  const ids = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    return { rootId: state.pages[0].id as string, childId: state.pages[1].id as string }
  })

  const rootRow = page.getByRole('treeitem').filter({ hasText: '문장군 상담' }).first()
  await rootRow.hover()
  await page.getByRole('button', { name: '문장군 상담 삭제' }).click()
  await page.getByRole('dialog', { name: '페이지를 삭제할까요?' }).getByRole('button', { name: '삭제' }).click()

  await expect.poll(() => page.evaluate(({ rootId, childId }) => {
    const state = JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}')
    const child = state.pages.find((candidate: { id: string }) => candidate.id === childId)
    return {
      rootExists: state.pages.some((candidate: { id: string }) => candidate.id === rootId),
      childParentId: child?.parentId,
      childRole: child?.role,
    }
  }, ids)).toEqual({ rootExists: false, childParentId: null, childRole: 'navigation' })

  await page.reload()
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible()
  await expect(page.getByRole('treeitem').filter({ hasText: '중문 상담 자료' })).toContainText('네비게이션')
})

test('persisted tree expansion hydrates without a server client mismatch', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Hydration failed')) hydrationErrors.push(message.text())
  })

  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').version)).toBe(2)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const root = page.getByRole('treeitem').first()
  await root.getByRole('button').first().click()
  await expect(page.getByRole('treeitem')).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('treeitem')).toHaveCount(2)
  expect(hydrationErrors).toEqual([])
})

test('page tree remains usable with 300 pages, per-node collapse, and search paths', async ({ page }) => {
  test.setTimeout(60_000)
  await page.evaluate(() => {
    const key = 'munjanggun:link-pages:v1'
    const state = JSON.parse(localStorage.getItem(key) ?? '{}')
    const root = state.pages[0]
    const template = state.pages[1]
    const children = Array.from({ length: 299 }, (_, index) => {
      const page = structuredClone(template)
      page.id = `tree-page-${String(index + 1).padStart(4, '0')}`
      page.slug = `tree-${String(index + 1).padStart(4, '0')}`
      page.slugAliases = []
      page.parentId = root.id
      page.sortOrder = index
      page.role = 'child'
      page.title = `자료 ${index + 1}`
      page.blocks = page.blocks.map((block: { id: string; pageId: string; content: { items?: Array<{ id: string }> } }, blockIndex: number) => ({
        ...block,
        id: `${page.id}-block-${blockIndex}`,
        pageId: page.id,
        content: block.content.items ? {
          ...block.content,
          items: block.content.items.map((item, itemIndex) => ({ ...item, id: `${page.id}-item-${itemIndex}` })),
        } : block.content,
      }))
      return page
    })
    state.pages = [root, ...children]
    state.selectedPageId = root.id
    localStorage.setItem(key, JSON.stringify(state))
    localStorage.removeItem('munjanggun:link-page-tree:v1')
  })
  await page.reload()

  await expect(page.getByLabel('페이지 목록').getByText('300', { exact: true })).toBeVisible()
  await expect(page.getByRole('treeitem')).toHaveCount(1)
  await page.getByRole('button', { name: '문장군 상담 펼치기' }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(300)
  await page.getByRole('button', { name: '문장군 상담 접기' }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(1)
  await page.getByRole('textbox', { name: '페이지 검색' }).fill('자료 299')
  await expect(page.getByRole('treeitem')).toHaveCount(2)
  await expect(page.getByRole('treeitem').filter({ hasText: '자료 299' })).toBeVisible()
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
  test.setTimeout(150_000)
  await page.getByRole('button', { name: '페이지 추가' }).first().click()
  await page.getByRole('button', { name: '자식 페이지' }).click()
  await page.getByRole('textbox', { name: '페이지 이름' }).fill('3단계 상세 자료')
  await page.locator('input[name="slug"]').fill('level-three')
  await page.getByRole('combobox', { name: /상위 페이지/ }).selectOption({ label: '— 중문 상담 자료' })
  await page.getByRole('button', { name: '설정 완료' }).click()

  await expect(page.getByRole('link', { name: '/l/level-three' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '자료 페이지' })).toHaveCount(0)

  await page.getByRole('treeitem').filter({ hasText: '문장군 상담' }).first().hover()
  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await expect(page.getByRole('combobox', { name: /상위 페이지/ })).toHaveCount(0)
  await page.getByRole('button', { name: '취소' }).click()

  await page.goto('/l/level-three')
  await expect(page.getByRole('heading', { name: '3단계 상세 자료' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.goto('/l/munjanggun')
  await expect(page).toHaveURL(/\/l\/munjanggun$/)
  const viewedPageIds = await page.evaluate(() => {
    const events = JSON.parse(localStorage.getItem('munjanggun:link-page-events:v1') ?? '[]') as Array<{ type: string; pageId: string }>
    return [...new Set(events.filter((event) => event.type === 'page_view').map((event) => event.pageId))]
  })
  expect(viewedPageIds.length).toBeGreaterThanOrEqual(2)

  await page.goto('/link-pages')
  await page.getByRole('treeitem').filter({ hasText: '문장군 상담' }).first().hover()
  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await page.locator('input[name="slug"]').fill('munjanggun-new')
  await page.getByRole('button', { name: '설정 완료' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.slug)).toBe('munjanggun-new')
  await page.goto('/l/munjanggun')
  await expect(page).toHaveURL(/\/l\/munjanggun-new$/)

  await page.goto('/link-pages')
  await page.getByRole('treeitem').filter({ hasText: '문장군 상담' }).first().hover()
  await page.getByRole('button', { name: '문장군 상담 편집' }).click()
  await page.locator('input[name="slug"]').fill('munjanggun')
  await page.getByRole('button', { name: '설정 완료' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('munjanggun:link-pages:v1') ?? '{}').pages?.[0]?.slug)).toBe('munjanggun')
  await page.reload()
  await expect(page.getByRole('treeitem').filter({ hasText: '문장군 상담' }).first()).toBeVisible()
  await expect(page.getByRole('treeitem').filter({ hasText: '3단계 상세 자료' }).first()).toBeVisible()
})
