import { test, expect } from '@playwright/test'

const qaUrl = (baseURL: string | undefined, path: string) => {
  const base = process.env.QA_BASE || baseURL || process.env.BASE_URL
  return base ? new URL(path, base).toString() : path
}

test.use({ viewport: { width: 390, height: 844 } })

test('#585 quest fullscreen map popup opens route in all navigators', async ({ page, baseURL }) => {
  const opened: string[] = []
  await page.exposeFunction('__captureOpen', (url: string) => {
    opened.push(url)
  })
  await page.addInitScript(() => {
    const orig = window.open
    window.open = function (url?: string | URL, ...rest: unknown[]) {
      // @ts-ignore test bridge
      window.__captureOpen?.(String(url ?? ''))
      return orig.apply(window, [url, ...rest] as any)
    }
  })
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

  await page.goto(qaUrl(baseURL, '/quests/1/krakow-dragon'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  // Dismiss cookie consent if present
  const consent = page.getByText('Принять', { exact: true }).first()
  if (await consent.isVisible().catch(() => false)) {
    await consent.click().catch(() => {})
    await page.waitForTimeout(400)
  }

  // Accept the quest disclaimer checkbox, then start the wizard
  const disclaimer = page.getByText('Я понимаю', { exact: false }).first()
  if (await disclaimer.isVisible().catch(() => false)) {
    await disclaimer.click().catch(() => {})
    await page.waitForTimeout(400)
  }
  await page.getByText('Начать квест', { exact: false }).first().click()
  await page.waitForTimeout(2500)

  // Expand the quest map to fullscreen
  await page.getByLabel('Открыть карту квеста на весь экран').first().click()
  await page.waitForTimeout(2500)

  // Open a marker popup (markers from inline + fullscreen share .qmark)
  const markers = page.locator('.qmark')
  const count = await markers.count()
  let popupShown = false
  for (let i = count - 1; i >= 0 && !popupShown; i--) {
    await markers.nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
    popupShown = await page
      .getByText('Довести меня', { exact: false })
      .first()
      .isVisible()
      .catch(() => false)
  }
  expect(popupShown).toBeTruthy()

  for (const provider of ['Google', 'Organic', 'Waze', 'Яндекс', 'OSM']) {
    await expect(page.getByText(provider, { exact: true }).first()).toBeVisible()
  }

  await page.screenshot({ path: 'e2e/__screenshots__/qa-585-fsmap-popup.png', fullPage: false })

  // Organic must go through the #580 builder (web branch -> omaps.app; native -> om://)
  await page.getByText('Organic', { exact: true }).first().click()
  await page.waitForTimeout(800)
  expect(opened.some((u) => u.includes('omaps.app'))).toBeTruthy()
})
