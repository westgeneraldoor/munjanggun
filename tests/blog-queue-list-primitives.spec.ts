import { expect, test, type Page } from '@playwright/test'

async function openQueue(page: Page) {
  const loginParams = new URLSearchParams({ role: 'administrator', next: '/admin/platform/blog' })
  if (process.env.PLAYWRIGHT_LOGIN_TOKEN) loginParams.set('token', process.env.PLAYWRIGHT_LOGIN_TOKEN)

  await page.goto(`/api/dev/playwright-login?${loginParams}`, { waitUntil: 'domcontentloaded' })
  await page.goto('/admin/platform/blog', { waitUntil: 'networkidle' })
  test.skip(new URL(page.url()).pathname === '/admin/login', 'administrator dev login is not configured in this environment')
  await expect(page.getByRole('heading', { name: '블로그 콘텐츠 큐' })).toBeVisible()
}

test('desktop queue keeps native table semantics and a real editor link', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openQueue(page)

  const table = page.getByRole('table', { name: '블로그 콘텐츠 목록' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader')).toHaveCount(4)
  await expect(table.getByRole('columnheader')).toHaveText(['제목', '상태', '카테고리', '수정일'])
  await expect(page.getByRole('group', { name: '상태 필터' }).getByRole('button')).toHaveText(['전체', '초안', '발행', '휴지통'])
  const rows = table.getByRole('row')
  expect(await rows.count()).toBeGreaterThan(1)
  const editorLink = table.getByRole('link', { name: /에디터 열기/ }).first()
  await editorLink.focus()
  await expect(editorLink).toBeFocused()
  expect(await editorLink.getAttribute('href')).toMatch(/^\/admin\/platform\/blog\/[0-9a-f-]{36}$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('390px queue exposes the native mobile list and keyboard link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openQueue(page)

  await expect(page.getByRole('table', { name: '블로그 콘텐츠 목록' })).toBeHidden()
  const list = page.getByRole('list', { name: '블로그 콘텐츠 모바일 목록' })
  await expect(list).toBeVisible()
  const editorLink = list.getByRole('link', { name: /에디터 열기/ }).first()
  await editorLink.focus()
  await expect(editorLink).toBeFocused()
  expect(await editorLink.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  await expect(list.getByText(/검토 필요|검토중|사진필요|발행대기|발행완료/, { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})
