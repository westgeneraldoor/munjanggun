import { expect, test } from '@playwright/test'

test('Munjanggun semantic theme tokens are available globally', async ({ page }) => {
  await page.goto('/login')

  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      primaryAction: style.getPropertyValue('--mg-action-primary').trim().toLowerCase(),
      cardSurface: style.getPropertyValue('--mg-surface-card').trim().toLowerCase(),
      focusRing: style.getPropertyValue('--mg-focus-ring').trim().toLowerCase(),
    }
  })

  expect(tokens).toEqual({
    primaryAction: '#b35d43',
    cardSurface: '#fffcf7',
    focusRing: '#b35d43',
  })
})

test('theme scopes override semantic component tokens', async ({ page }) => {
  await page.goto('/login')

  const scopedTokens = await page.evaluate(() => {
    const normalizeColor = (value: string) => {
      const color = value.trim().toLowerCase()
      if (/^#[0-9a-f]{3}$/.test(color)) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      }
      return color
    }

    const portal = document.createElement('div')
    const admin = document.createElement('div')
    const showroom = document.createElement('div')
    portal.setAttribute('data-mg-theme', 'portal')
    admin.setAttribute('data-mg-theme', 'admin')
    showroom.setAttribute('data-mg-theme', 'showroom-dark')
    document.body.append(portal, admin, showroom)

    const read = (element: HTMLElement) => {
      const style = getComputedStyle(element)
      return {
        page: normalizeColor(style.getPropertyValue('--mg-surface-page')),
        card: normalizeColor(style.getPropertyValue('--mg-surface-card')),
        action: normalizeColor(style.getPropertyValue('--mg-action-primary')),
        text: normalizeColor(style.getPropertyValue('--mg-text-primary')),
      }
    }

    return {
      portal: read(portal),
      admin: read(admin),
      showroom: read(showroom),
    }
  })

  expect(scopedTokens.portal).toMatchObject({
    page: '#f5efe6',
    card: '#fffcf7',
    action: '#b35d43',
    text: '#171512',
  })
  expect(scopedTokens.admin).toMatchObject({
    page: '#f8f8fa',
    card: '#ffffff',
    action: '#c4a265',
    text: '#111114',
  })
  expect(scopedTokens.showroom).toMatchObject({
    page: '#0c0c0e',
    card: '#242429',
    action: '#c4a265',
    text: '#f5f5f7',
  })
})

test('customer portal uses the platform theme without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const response = await page.goto('/api/dev/playwright-login?role=customer&next=/portal')

  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }

  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }

  await expect(page.locator('[data-mg-theme="portal"]').first()).toBeVisible()
  await expect(page.getByRole('link', { name: '문장군 홈으로 이동' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
  await expect(page.locator('#card-measure')).toHaveAttribute('href', '/portal/measure/new')
  await expect(page.locator('#card-as')).toHaveAttribute('href', '/portal/as/new')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('customer portal groups blog activity for My Page convenience', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const response = await page.goto('/api/dev/playwright-login?role=customer&next=/portal')

  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }

  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }

  const blogActivity = page.getByRole('region', { name: '나의 블로그 활동' })
  await expect(blogActivity).toBeVisible()
  await expect(blogActivity.getByRole('heading', { name: '저장한 글' })).toBeVisible()
  await expect(blogActivity.getByRole('heading', { name: '도움된 글' })).toBeVisible()
  await expect(blogActivity.getByRole('heading', { name: '내 질문' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('login screen uses the Munjanggun platform theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/login?next=/portal')

  await expect(page.locator('[data-mg-theme="portal"]').first()).toBeVisible()
  await expect(page.locator('[data-mg-theme="portal"] span').filter({ hasText: /^문장군$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /카카오/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /이메일/ })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('customer intake routes use the platform theme without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })

  for (const route of ['/portal/measure/new', '/portal/as/new']) {
    const response = await page.goto(`/api/dev/playwright-login?role=customer&next=${encodeURIComponent(route)}`)

    if (response && response.status() >= 500) {
      test.skip(true, 'Dev Supabase login is not configured in this environment.')
    }

    if (page.url().includes('/login')) {
      test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
    }

    await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`))
    await expect(page.locator('[data-mg-theme="portal"]').first()).toBeVisible()
    await expect(page.locator('header a[href="/portal"]').first()).toBeVisible()
    await expect(page.locator('header a[href="/"]').filter({ hasText: 'MUNJANGGUN' }).first()).toBeVisible()
    await expect(page.locator('main').first()).toBeVisible()

    await page.keyboard.press('Tab')
    const focusedOutline = await page.evaluate(() => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return null
      const style = getComputedStyle(active)
      return {
        id: active.id,
        href: active.getAttribute('href'),
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
      }
    })

    expect(focusedOutline?.id || focusedOutline?.href || '').not.toBe('')
    expect(focusedOutline?.outlineStyle).not.toBe('none')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }
})

test('measurement intake preserves private blog question context after login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/login')
  await page.evaluate(() => {
    window.sessionStorage.setItem(
      'munjanggun:blog-question-draft:test-blog-post',
      '이 글 기준으로 우리집도 가능한지 궁금해요'
    )
  })

  const next = '/portal/measure/new?source=blog-question&post=test-blog-post'
  const response = await page.goto(`/api/dev/playwright-login?role=customer&next=${encodeURIComponent(next)}`)

  if (response && response.status() >= 500) {
    test.skip(true, 'Dev Supabase login is not configured in this environment.')
  }

  if (page.url().includes('/login')) {
    test.skip(true, 'Dev customer login redirected to the public login page in this environment.')
  }

  await expect(page).toHaveURL(/\/portal\/measure\/new\?source=blog-question&post=test-blog-post/)
  await expect(page.getByTestId('measure-blog-question-context')).toBeVisible()
  await expect(page.getByTestId('measure-blog-question-context')).toContainText('블로그 글 질문에서 이어졌어요.')

  await page.locator('footer button').last().click()
  await page.locator('input[autocomplete="name"]').fill('테스트')
  await page.locator('input[autocomplete="tel"]').fill('01012345678')
  await page.locator('footer button').last().click()

  await page.getByRole('button', { name: /주소 검색/ }).click()
  await page.getByRole('button', { name: /수동 입력/ }).last().click()
  await page.locator('input[placeholder*="도로명"]').fill('서울시 강남구 테스트로 1')
  await page.locator('footer button').last().click()

  await page.locator('input[type="checkbox"]').first().check({ force: true })
  await page.locator('footer button').last().click()

  await page.locator('button[aria-disabled="false"][aria-pressed]').first().click()
  await page.locator('footer button').last().click()

  await expect(page.getByTestId('measure-message')).toHaveValue(/test-blog-post[\s\S]*질문 메모: 이 글 기준으로 우리집도 가능한지 궁금해요/)
  const draftCleared = await page.evaluate(() => (
    window.sessionStorage.getItem('munjanggun:blog-question-draft:test-blog-post') === null
    && window.localStorage.getItem('munjanggun:blog-question-draft:test-blog-post') === null
  ))
  expect(draftCleared).toBe(true)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
