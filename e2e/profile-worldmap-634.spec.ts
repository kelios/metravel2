import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

// [FE-634] T5/T6/T7 — вкладка профиля «Карта»: scratch-карта + флажки + тап→инфо.
const COUNTRY_PROGRESS = {
  total_count: 234, visited_count: 3, remaining_count: 231,
  countries: [
    { country_id: 1, country_code: 'BY', region: 'europe', title_ru: 'Беларусь', visited: true, visited_travels_count: 5, first_visited_date: '2018-05-01' },
    { country_id: 2, country_code: 'FR', region: 'europe', title_ru: 'Франция', visited: true, visited_travels_count: 2, first_visited_date: '2019-07-10' },
    { country_id: 3, country_code: 'JP', region: 'asia', title_ru: 'Япония', visited: true, visited_travels_count: 1, first_visited_date: '2020-01-03' },
    { country_id: 4, country_code: 'DE', region: 'europe', title_ru: 'Германия', visited: false, visited_travels_count: 0, first_visited_date: null },
  ],
}

test('profile «Карта»: карта + флажки + тап по стране', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERR:', e.message))
  await ensureAuthedStorageFallback(page)
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await mockFakeAuthApis(page)
  await page.route('**/api/user/*/country-progress/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COUNTRY_PROGRESS) }))

  await preacceptCookies(page)
  await gotoWithRetry(page, '/profile')

  const tab = page.locator('[aria-label="Карта мира"]').first()
  await tab.waitFor({ state: 'visible', timeout: 30000 })
  await tab.click()
  await expect(page.getByText('Карта мира', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(() => document.querySelectorAll('svg path').length >= 150, undefined, { timeout: 20000 })

  // T3: посещённые отличаются заливкой.
  const stats = await page.evaluate(() => {
    const wp = Array.from(document.querySelectorAll('svg path')).filter((p) => (p.getAttribute('d') || '').length > 200)
    const fc: Record<string, number> = {}
    for (const p of wp) { const f = p.getAttribute('fill') || ''; fc[f] = (fc[f] || 0) + 1 }
    const fills = Object.entries(fc).sort((a, b) => b[1] - a[1])
    return { count: wp.length, distinctFills: fills.length, visitedPathCount: fills.slice(1).reduce((s, [, n]) => s + n, 0) }
  })
  console.log('MAPSTATS', JSON.stringify(stats))
  expect(stats.count).toBeGreaterThan(140)
  expect(stats.distinctFills).toBeGreaterThanOrEqual(2)
  expect(stats.visitedPathCount).toBeGreaterThanOrEqual(3)

  // T4: флаг-маркеры на посещённых (эмодзи-флаги BY/FR/JP).
  const flagCount = await page.evaluate(() => {
    const re = /[\u{1F1E6}-\u{1F1FF}]/u
    return Array.from(document.querySelectorAll('*'))
      .filter((el) => el.children.length === 0 && re.test(el.textContent || '')).length
  })
  console.log('FLAGS', flagCount)
  expect(flagCount).toBeGreaterThanOrEqual(3)

  // T6: тап по посещённой стране → инфо-карточка.
  const clicked = await page.evaluate(() => {
    const wp = Array.from(document.querySelectorAll('svg path')).filter((p) => (p.getAttribute('d') || '').length > 200)
    const fc: Record<string, Element[]> = {}
    for (const p of wp) { const f = p.getAttribute('fill') || ''; (fc[f] = fc[f] || []).push(p) }
    const minority = Object.values(fc).sort((a, b) => a.length - b.length)[0]
    const el = minority && minority[0]
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })
  expect(clicked).toBe(true)
  await expect(page.locator('[aria-label="Закрыть"]').first()).toBeVisible({ timeout: 5000 })
})
