import { expect, test } from '@playwright/test'

test('admin login is centered without the absent desktop sidebar offset', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/admin/login')
  await expect(page.getByRole('heading', { name: '문장군 관리자' })).toBeVisible()

  const geometry = await page.locator('main').evaluate((main) => {
    const rect = main.getBoundingClientRect()
    const styles = getComputedStyle(main)
    const card = main.querySelector('h1')?.parentElement?.getBoundingClientRect()
    return {
      x: rect.x,
      width: rect.width,
      marginLeft: styles.marginLeft,
      paddingTop: styles.paddingTop,
      cardCenterDelta: card ? Math.abs((card.left + card.width / 2) - window.innerWidth / 2) : null,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })

  expect(geometry.x).toBe(0)
  expect(geometry.width).toBe(1366)
  expect(geometry.marginLeft).toBe('0px')
  expect(geometry.paddingTop).toBe('0px')
  expect(geometry.cardCenterDelta).not.toBeNull()
  expect(geometry.cardCenterDelta!).toBeLessThan(2)
  expect(geometry.noOverflow).toBe(true)
})

test('admin login has no mobile navigation offset and preserves keyboard focus at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/admin/login')

  await expect(page.getByRole('banner')).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: '이메일' })).toBeFocused()

  const state = await page.locator('main').evaluate((main) => {
    const rect = main.getBoundingClientRect()
    const styles = getComputedStyle(main)
    return {
      x: rect.x,
      width: rect.width,
      paddingTop: styles.paddingTop,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })

  expect(state).toEqual({
    x: 0,
    width: 390,
    paddingTop: '0px',
    reducedMotion: true,
    noOverflow: true,
  })
})
