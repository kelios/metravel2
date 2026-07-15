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

  // Accept the quest disclaimer checkbox, then start the wizard. Clicking the
  // adjacent label text does not toggle the actual accessible control on web.
  const consentCheckbox = page.getByTestId('quest-consent-checkbox')
  if (await consentCheckbox.isVisible().catch(() => false)) {
    const consentStart = page.getByTestId('quest-consent-start')
    await expect(async () => {
      if (!(await consentStart.isEnabled())) await consentCheckbox.click()
      await expect(consentStart).toBeEnabled({ timeout: 1_000 })
    }).toPass({ timeout: 30_000, intervals: [500, 1_000] })

    await consentStart.click()
  }

  // Expand the quest map to fullscreen
  const openFullscreenMap = page.getByLabel('Открыть карту квеста на весь экран').first()
  await expect(openFullscreenMap).toBeVisible({ timeout: 30_000 })
  await openFullscreenMap.click()

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
