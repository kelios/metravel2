import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

import { preacceptCookies } from './helpers/navigation'

const RN_WEB_TEXT_NODE_ERROR =
  'Unexpected text node: . A text node cannot be a child of a <View>.'

const VIEWPORTS = [
  { width: 1440, height: 1100, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile-web' },
] as const

const TRAVEL_PATH = '/travels/563/?returnTo=%2Fsearch'
const CONTROL_PATH = '/contact'

function attachConsoleCollector(page: Page) {
  const messages: string[] = []
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') messages.push(message.text())
  }
  page.on('console', onConsole)
  return {
    messages,
    textNodeCount: () => messages.filter((text) => text.includes(RN_WEB_TEXT_NODE_ERROR)).length,
    dispose: () => page.off('console', onConsole),
  }
}

async function waitForTravelDetails(page: Page) {
  await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('travel-details-description')).toBeVisible({ timeout: 30_000 })
}

async function scrollToPopular(page: Page) {
  const popular = page.locator('[data-section-key="popular"], [data-testid="travel-details-popular-loaded"]')
  await popular.first().scrollIntoViewIfNeeded().catch(() => null)
  await page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="travel-details-scroll"]') as HTMLElement | null
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    }
    window.scrollTo(0, document.body.scrollHeight)
  })
  await popular.first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => null)
  await page.waitForTimeout(1500)
}

test.describe('Travel details RN-Web empty text node console', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: 0 Unexpected text node errors before and after PopularTravelList`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const consoleCollector = attachConsoleCollector(page)
      await preacceptCookies(page)

      await page.goto(TRAVEL_PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await waitForTravelDetails(page)
      await page.waitForTimeout(1500)

      const beforePopular = consoleCollector.textNodeCount()
      await scrollToPopular(page)
      const afterPopular = consoleCollector.textNodeCount()
      const logged = consoleCollector.messages.join('\n')
      consoleCollector.dispose()

      expect(beforePopular, `${viewport.label} before PopularTravelList: ${logged}`).toBe(0)
      expect(afterPopular, `${viewport.label} after PopularTravelList: ${logged}`).toBe(0)
    })
  }

  test('control route stays at 0 Unexpected text node errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    const consoleCollector = attachConsoleCollector(page)
    await preacceptCookies(page)
    await page.goto(CONTROL_PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(2000)
    expect(consoleCollector.textNodeCount()).toBe(0)
    consoleCollector.dispose()
  })
})
