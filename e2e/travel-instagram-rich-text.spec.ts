import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

test.describe('Travel rich-text Instagram embeds', () => {
  test('renders Instagram content as visible fallback cards without iframe policy violations @smoke', async ({ page }) => {
    const consoleMessages: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error' || /Permissions policy violation: unload is not allowed/i.test(text)) {
        consoleMessages.push(text)
      }
    })

    await preacceptCookies(page)
    await gotoWithRetry(
      page,
      '/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele',
      { timeout: 90_000 },
    )
    await page.waitForLoadState('networkidle').catch(() => null)

    const richText = page.locator('.travel-rich-text').first()
    await expect(richText).toBeVisible({ timeout: 60_000 })

    const instagramCards = page.locator('.travel-rich-text .rich-social-card--instagram')
    await expect(instagramCards.first()).toBeVisible({ timeout: 30_000 })
    expect(await instagramCards.count()).toBeGreaterThan(0)

    await expect(page.locator('iframe[src*="instagram.com"]')).toHaveCount(0)

    const hasUnloadViolation = consoleMessages.some((message) =>
      /Permissions policy violation: unload is not allowed/i.test(message),
    )
    expect(hasUnloadViolation).toBe(false)
  })
})

