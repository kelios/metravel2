import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:8081'

test.use({ viewport: { width: 390, height: 844 } })

test('#585 quest map popup shows nav providers', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto(`${BASE}/quests/1/krakow-dragon`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  console.log('TOKEN', await page.evaluate(() => window.localStorage.getItem('secure_userToken')))
  console.log('BODYTEXT', (await page.locator('body').innerText()).slice(0, 400))
  await page.screenshot({ path: 'e2e/__screenshots__/qa-585-debug.png', fullPage: true })
  // Accept consent gate if present (e.g. "Начать квест" / "Принять")
  for (const t of ['Начать квест', 'Начать', 'Принять', 'Согласен', 'Продолжить']) {
    const btn = page.getByText(t, { exact: false }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(2000)
      break
    }
  }
  // Wait for the quest map to mount (leaflet markers)
  await page.waitForSelector('.qmark', { timeout: 60000 })
  // Open a marker popup
  await page.locator('.qmark').first().click()
  await page.waitForTimeout(800)
  const navLabel = page.getByText('Довести меня', { exact: false }).first()
  await expect(navLabel).toBeVisible({ timeout: 15000 })
  for (const provider of ['Google', 'Organic', 'Waze', 'Яндекс', 'OSM']) {
    await expect(page.getByText(provider, { exact: true }).first()).toBeVisible()
  }
  await page.screenshot({ path: 'e2e/__screenshots__/qa-585-quest-nav.png', fullPage: false })
})

test('#581 nearby section list/map toggle on travel detail', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto(`${BASE}/travels/minsk-za-vykhodnye-putevoditel-po-stolitse-belarusi`, {
    waitUntil: 'domcontentloaded',
  })
  // Scroll to the "Рядом можно посмотреть" section to mount the deferred list
  const heading = page.getByText('Рядом можно посмотреть', { exact: false }).first()
  await heading.scrollIntoViewIfNeeded({ timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  // The toggle is a SegmentedControl with "Список" and "Карта"
  const mapTab = page.getByText('Карта', { exact: true }).first()
  await expect(mapTab).toBeVisible({ timeout: 30000 })
  await page.screenshot({ path: 'e2e/__screenshots__/qa-581-nearby-toggle-list.png', fullPage: false })
  await mapTab.click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/__screenshots__/qa-581-nearby-toggle-map.png', fullPage: false })
})
