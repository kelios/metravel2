import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const SHOTS = '/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/724c68c9-dfe5-49d4-a986-94c8567e57b2/scratchpad'
const CP = {
  total_count: 234, visited_count: 6, remaining_count: 228,
  countries: [
    { country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 12, first_visited_date: '2015-05-01' },
    { country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 3, first_visited_date: '2017-07-10' },
    { country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2019-01-03' },
    { country_code: 'US', region: 'northAmerica', title_ru: 'США', visited: true, visited_travels_count: 2, first_visited_date: '2016-09-01' },
    { country_code: 'BR', region: 'southAmerica', title_ru: 'Бразилия', visited: true, visited_travels_count: 1, first_visited_date: '2018-02-01' },
    { country_code: 'AU', region: 'oceania', title_ru: 'Австралия', visited: true, visited_travels_count: 1, first_visited_date: '2020-12-01' },
  ],
}
test('desktop tap → info card', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERR:', e.message))
  await page.setViewportSize({ width: 1280, height: 1100 })
  await ensureAuthedStorageFallback(page)
  await page.route('**/api/**', (route) => route.request().method() !== 'GET' ? route.continue() : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await mockFakeAuthApis(page)
  await page.route('**/api/user/*/country-progress/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CP) }))
  await preacceptCookies(page)
  await gotoWithRetry(page, '/profile')
  const tab = page.locator('[aria-label="Карта мира"]').first()
  await tab.waitFor({ state: 'visible', timeout: 30000 })
  await tab.click()
  await page.waitForFunction(() => document.querySelectorAll('svg path').length >= 150, undefined, { timeout: 20000 })
  // диагностика: проброшен ли id в DOM
  const hasId = await page.locator('#wc-BY').count()
  console.log('HAS-ID', hasId)
  let opened = false, where = ''
  for (const code of ['BY', 'FR', 'JP', 'BR']) {
    const el = page.locator('#wc-' + code).first()
    if (!(await el.count())) continue
    await el.scrollIntoViewIfNeeded().catch(() => {})
    await el.click({ force: true }).catch(() => {})
    await page.waitForTimeout(350)
    if (await page.locator('[aria-label="Закрыть"]').first().isVisible().catch(() => false)) { opened = true; where = code; break }
  }
  console.log('TAP-OPENED', opened, where)
  expect(opened).toBe(true)
  await page.waitForTimeout(400)
  await page.locator('[aria-label="Закрыть"]').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: SHOTS + '/shot-desktop-tap.png' })
})
