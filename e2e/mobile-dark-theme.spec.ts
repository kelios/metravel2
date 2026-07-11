import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const THEME_COLOR_DARK = '#1a1a1a'
const THEME_COLOR_LIGHT = '#ffffff'

async function seedTheme(page: any, theme: 'light' | 'dark' | 'auto') {
  await page.addInitScript((savedTheme: string) => {
    window.localStorage.setItem('theme', savedTheme)
  }, theme)
}

test.describe('@mobile Mobile dark theme', () => {
  test.use({ viewport: MOBILE_VIEWPORT, colorScheme: 'light' })

  test('saved dark theme overrides a light system theme and persists after reload', async ({ page }) => {
    await preacceptCookies(page)
    await seedTheme(page, 'dark')
    await gotoWithRetry(page, '/')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#app-theme-color')).toHaveAttribute(
      'content',
      THEME_COLOR_DARK,
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#app-theme-color')).toHaveAttribute(
      'content',
      THEME_COLOR_DARK,
    )
  })

  test('theme controls update page and browser chrome immediately', async ({ page }) => {
    await preacceptCookies(page)
    await seedTheme(page, 'dark')
    await gotoWithRetry(page, '/')

    await page.getByTestId('mobile-menu-open').click()
    await expect(page.getByTestId('mobile-menu-panel')).toBeVisible()

    await page.getByTestId('theme-toggle-light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('#app-theme-color')).toHaveAttribute(
      'content',
      THEME_COLOR_LIGHT,
    )

    await page.getByTestId('theme-toggle-dark').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#app-theme-color')).toHaveAttribute(
      'content',
      THEME_COLOR_DARK,
    )
  })

  for (const route of ['/', '/search', '/map', '/places', '/quests', '/login']) {
    test(`${route} has no horizontal overflow in dark mode`, async ({ page }) => {
      await preacceptCookies(page)
      await seedTheme(page, 'dark')
      await gotoWithRetry(page, route)

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    })
  }
})
