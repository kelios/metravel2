import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const SHOTS = '/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/724c68c9-dfe5-49d4-a986-94c8567e57b2/scratchpad'
const COUNTRY_PROGRESS = {
  total_count: 234, visited_count: 6, remaining_count: 228,
  countries: [
    { country_id: 1, country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 12, first_visited_date: '2015-05-01' },
    { country_id: 2, country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 3, first_visited_date: '2017-07-10' },
    { country_id: 3, country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2019-01-03' },
    { country_id: 4, country_code: 'US', region: 'northAmerica', title_ru: 'США', visited: true, visited_travels_count: 2, first_visited_date: '2016-09-01' },
    { country_id: 5, country_code: 'BR', region: 'southAmerica', title_ru: 'Бразилия', visited: true, visited_travels_count: 1, first_visited_date: '2018-02-01' },
    { country_id: 6, country_code: 'AU', region: 'oceania', title_ru: 'Австралия', visited: true, visited_travels_count: 1, first_visited_date: '2020-12-01' },
    { country_id: 7, country_code: 'DE', region: 'europe', title_ru: 'Германия', visited: false, visited_travels_count: 0, first_visited_date: null },
  ],
}
async function setup(page) {
  await ensureAuthedStorageFallback(page)
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await mockFakeAuthApis(page)
  await page.route('**/api/user/*/country-progress/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COUNTRY_PROGRESS) }))
  await preacceptCookies(page)
}
async function openMap(page) {
  await gotoWithRetry(page, '/profile')
  const tab = page.locator('[aria-label="Карта мира"]').first()
  await tab.waitFor({ state: 'visible', timeout: 30000 })
  await tab.click()
  await expect(page.getByText('Карта мира', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(() => document.querySelectorAll('svg path').length >= 150, undefined, { timeout: 20000 })
  await page.waitForTimeout(800)
}
test('desktop light + tap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await setup(page); await openMap(page)
  await page.screenshot({ path: SHOTS + '/shot-desktop.png', fullPage: true })
  // клик по крупнейшей посещённой стране (минорный fill, макс длина d)
  await page.evaluate(() => {
    const wp = Array.from(document.querySelectorAll('svg path')).filter((p) => (p.getAttribute('d') || '').length > 200)
    const fc = {}
    for (const p of wp) { const f = p.getAttribute('fill') || ''; (fc[f] = fc[f] || []).push(p) }
    const minority = Object.values(fc).sort((a, b) => a.length - b.length)[0] || []
    const target = minority.slice().sort((a, b) => (b.getAttribute('d')||'').length - (a.getAttribute('d')||'').length)[0]
    if (!target) return
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
    }
  })
  await expect(page.locator('[aria-label="Закрыть"]').first()).toBeVisible({ timeout: 6000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: SHOTS + '/shot-desktop-tap.png' })
})
test('mobile light', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await setup(page); await openMap(page)
  await page.screenshot({ path: SHOTS + '/shot-mobile.png', fullPage: true })
})
test('desktop dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 1280, height: 1100 })
  await setup(page); await openMap(page)
  await page.screenshot({ path: SHOTS + '/shot-dark.png', fullPage: true })
})
