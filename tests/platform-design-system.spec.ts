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
    primaryAction: '#171717',
    cardSurface: '#fff',
    focusRing: '#3d5b4b',
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
    page: '#f7f7f4',
    card: '#ffffff',
    action: '#171717',
    text: '#171717',
  })
  expect(scopedTokens.admin).toMatchObject({
    page: '#f8f8fa',
    card: '#ffffff',
    action: '#171717',
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
  await expect(page.getByRole('link', { name: '문장군 블로그로 이동' })).toHaveAttribute('href', '/blog')
  await expect(page.getByRole('button', { name: '계정 메뉴' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('link', { name: '무료 실측상담' })).toHaveAttribute('href', '/measure')
  await expect(page.getByRole('link', { name: 'A/S 접수' })).toHaveAttribute('href', '/portal/as/new')

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

  const blogActivity = page.getByRole('group', { name: '나의 활동 선택' })
  await expect(blogActivity).toBeVisible()
  await expect(blogActivity.getByRole('button', { name: /좋아요한 글/ })).toBeVisible()
  await expect(blogActivity.getByRole('button', { name: /내 질문/ })).toBeVisible()
  await expect(blogActivity.getByRole('button', { name: /최근 본 글/ })).toBeVisible()
  await expect(page.getByText('저장한 글', { exact: true })).toHaveCount(0)
  await expect(page.getByText('도움된 글', { exact: true })).toHaveCount(0)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('login screen uses the Munjanggun platform theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/login?next=/portal')

  await expect(page.locator('[data-mg-theme="portal"]').first()).toBeVisible()
  await expect(page.getByText('MUNJANGGUN', { exact: true })).toBeVisible()
  await expect(page.getByText('MY', { exact: true })).toBeVisible()
  await expect(page.getByText('쇼룸 홈', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '문장군 블로그로 돌아가기' })).toHaveAttribute('href', '/blog')
  await expect(page.getByRole('button', { name: /카카오/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /이메일/ })).toBeVisible()

  const title = await page.getByRole('heading', { level: 1 }).evaluate(element => {
    const style = getComputedStyle(element)
    return { fontFamily: style.fontFamily, fontSize: Number.parseFloat(style.fontSize) }
  })
  expect(title.fontFamily).toContain('Pretendard')
  expect(title.fontFamily).not.toContain('Tmoney RoundWind')
  expect(title.fontSize).toBeLessThan(32)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('blog launch home has image-led hero without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/blog')

  const hero = page.getByTestId('blog-home-hero')
  await expect(hero.getByRole('heading', { name: '문 하나가, 집의 흐름을 바꿉니다.' })).toBeVisible()
  await expect(hero.getByRole('link', { name: '무료 방문실측 상담' })).toHaveAttribute('href', '/measure')
  await expect(hero.getByRole('img', { name: '햇빛이 드는 밝은 거실과 공간을 나누는 슬림 중문' })).toBeVisible()

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
    await expect(page.locator('header a[href="/blog"]').filter({ hasText: 'MUNJANGGUN' }).first()).toBeVisible()
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

test('free measurement landing is public and leads into the protected intake form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/measure')

  await expect(page.getByRole('heading', { name: /집에 맞는 문은/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '문장군 홈으로 이동' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: /문장군 블로그로 돌아가기/ })).toHaveCount(0)
  const heroCta = page.getByTestId('measure-hero-cta')
  await expect(heroCta).toHaveAttribute('href', '/portal/measure/new')
  await expect(heroCta).toHaveAccessibleName('무료방문 실측견적 신청')
  const conditionGroup = page.getByRole('group', { name: '현관 조건 선택' })
  await expect(conditionGroup).toBeVisible()
  await expect(conditionGroup.getByRole('button', { name: /신발장 간섭/ })).toHaveAttribute('aria-pressed', 'true')
  const finishCondition = conditionGroup.getByRole('button', { name: /마감 간섭/ })
  await finishCondition.focus()
  await page.keyboard.press('Enter')
  await expect(finishCondition).toHaveAttribute('aria-pressed', 'true')

  const siteVisitStep = page.getByRole('button', { name: /03 방문 실측/ })
  await siteVisitStep.focus()
  await page.keyboard.press('Enter')
  await expect(siteVisitStep).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('현장 구조와 마감, 시공 가능 조건을 확인합니다.')).toBeVisible()
  await expect(page.getByTestId('measure-mobile-cta')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('measurement CTA keeps the protected intake return path after login', async ({ page }) => {
  await page.goto('/measure')

  const heroCta = page.getByTestId('measure-hero-cta')
  await expect(heroCta).toHaveAttribute('href', '/portal/measure/new')
  await heroCta.click()
  await expect(page).toHaveURL(/\/login\?next=%2Fportal%2Fmeasure%2Fnew/)
})

test('measurement landing reuses customer and administrator account menu behavior', async ({ page }) => {
  const loginAs = async (role: 'customer' | 'administrator') => {
    const response = await page.goto(`/api/dev/playwright-login?role=${role}&next=/measure`)
    if (response && response.status() >= 500) {
      test.skip(true, 'Dev Supabase login is not configured in this environment.')
    }
    if (page.url().includes('/login')) {
      test.skip(true, 'Dev user login redirected to the public login page in this environment.')
    }
    await expect(page).toHaveURL(/\/measure$/)
  }

  await loginAs('customer')
  const customerMenu = page.getByRole('button', { name: '계정 메뉴 열기' })
  await expect(customerMenu).toBeVisible()
  await customerMenu.click()
  await expect(page.getByRole('menuitem', { name: '마이페이지' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '무료방문견적 신청' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '플랫폼 어드민' })).toHaveCount(0)

  await loginAs('administrator')
  const administratorMenu = page.getByRole('button', { name: '계정 메뉴 열기' })
  await administratorMenu.click()
  await expect(page.getByRole('menuitem', { name: '플랫폼 어드민' })).toBeVisible()
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
