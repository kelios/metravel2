import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const COUNTRY_PROGRESS = {
  total_count: 234, visited_count: 6, remaining_count: 228,
  countries: [
    { country_id: 1, country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 5, first_visited_date: '2018-05-01' },
    { country_id: 2, country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 2, first_visited_date: '2019-07-10' },
    { country_id: 3, country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2020-01-03' },
    { country_id: 5, country_code: 'IT', region: 'europe', title_ru: 'Италия', visited: true, visited_travels_count: 1, first_visited_date: '2021-01-03' },
    { country_id: 6, country_code: 'ES', region: 'europe', title_ru: 'Испания', visited: true, visited_travels_count: 1, first_visited_date: '2022-01-03' },
    { country_id: 7, country_code: 'US', region: 'americas', title_ru: 'США', visited: true, visited_travels_count: 1, first_visited_date: '2023-01-03' },
  ],
}
const MY_TRAVELS = { data: [], total: 0 }

test('fullscreen worldmap fills mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ensureAuthedStorageFallback(page)
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await mockFakeAuthApis(page)
  await page.route('**/api/travels/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MY_TRAVELS) }))
  await page.route('**/api/user/*/country-progress/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COUNTRY_PROGRESS) }))

  await preacceptCookies(page)
  await gotoWithRetry(page, '/profile')

  const tab = page.locator('[aria-label="Карта мира"]').first()
  await tab.waitFor({ state: 'visible', timeout: 30000 })
  await tab.click()
  await page.waitForFunction(() => document.querySelectorAll('svg path').length >= 150, undefined, { timeout: 20000 })

  await page.screenshot({ path: '/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/b862de64-0759-47eb-8763-b520b0090dbc/scratchpad/wm-inline.png' })

  // Открыть на весь экран.
  await page.locator('[aria-label="Открыть карту во весь экран"]').first().click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/b862de64-0759-47eb-8763-b520b0090dbc/scratchpad/wm-fullscreen.png' })

  // Числа: высота видимой карты и scale <g>.
  const metrics = await page.evaluate(() => {
    const byEls = Array.from(document.querySelectorAll('[id="wc-BY"]'))
    const svg = (byEls[byEls.length - 1]?.closest('svg') ?? null) as SVGSVGElement | null
    const gs = Array.from(document.querySelectorAll('svg g'))
    const mine = gs.find((el) => /scale\([0-9.]+\)\s*$/.test(el.getAttribute('transform') || ''))
    const m = /scale\(([0-9.]+)\)/.exec(mine?.getAttribute('transform') || '')
    const r = svg?.getBoundingClientRect()
    return {
      innerH: window.innerHeight,
      svgRectW: r ? Math.round(r.width) : null,
      svgRectH: r ? Math.round(r.height) : null,
      scale: m ? Number(m[1]) : 1,
    }
  })
  console.log('FS_METRICS', JSON.stringify(metrics))
  expect(metrics.scale).toBeGreaterThan(1.2)
})
