// ВРЕМЕННАЯ probe-спека (удаляется после прогона): проверка зазоров и полной
// видимости карточек в рельсах вкладок «Подборка месяца / Рекомендации /
// Хочу поехать / История» на десктопе. Данные коллекций замоканы route'ами —
// на сервер ничего не пишется.
import { test, expect } from '@playwright/test'
import { gotoWithRetry, tid } from './helpers/navigation'
import { seedNecessaryConsent } from './helpers/storage'

const OUT_DIR = '.codex-temp/recs-rails-probe'

// idBase у каждой коллекции свой: WeeklyHighlights исключает из «Подборки месяца»
// всё, что есть в истории просмотров — пересечение id опустошило бы рельсу.
const makeCards = (prefix: string, count: number, idBase: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: idBase + i,
    slug: `${prefix}-${i + 1}`,
    url: `/travels/${prefix}-${i + 1}`,
    name: `${prefix} маршрут ${i + 1}: длинное название для проверки переноса строк`,
    countryName: 'Беларусь',
    travel_image_thumb_url: `https://images.unsplash.com/photo-${1500000000100 + i}?auto=format&fit=crop&w=900&q=80`,
    updated_at: new Date(Date.now() - i * 86400000).toISOString(),
  }))

async function mockCollections(page: import('@playwright/test').Page) {
  const fulfill = (body: unknown) => async (route: import('@playwright/test').Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  }
  const favs = fulfill(makeCards('probe-fav', 9, 921000))
  const hist = fulfill(makeCards('probe-hist', 6, 922000))
  const recs = fulfill(makeCards('probe-rec', 6, 923000))
  const month = fulfill(makeCards('probe-month', 5, 924000))
  await page.route('**/api/user/*/favorite-travels/**', favs)
  await page.route('**/user/*/favorite-travels/**', favs)
  await page.route('**/api/user/*/history/**', hist)
  await page.route('**/user/*/history/**', hist)
  await page.route('**/api/user/*/recommended-travels/**', recs)
  await page.route('**/user/*/recommended-travels/**', recs)
  await page.route('**/api/travels/of-month/**', month)
  await page.route('**/travels/of-month/**', month)
}

type RailProbe = {
  count: number
  widths: number[]
  gaps: number[]
  cardTop: number
  cardBottom: number
  wrapperBottom: number
  panelBottom: number
  contentFullyVisible: boolean
}

async function probeRail(page: import('@playwright/test').Page, railTestId: string): Promise<RailProbe | null> {
  return page.evaluate((railId) => {
    const rail = document.querySelector(`[data-testid="${railId}"]`)
    const wrapper = document.querySelector('[data-testid="recommendations-list-header"]')
    if (!rail || !wrapper) return null
    const cards = Array.from(rail.querySelectorAll('[data-testid^="tab-travel-card-"]')).filter((el) => {
      const t = el.getAttribute('data-testid') || ''
      return !t.endsWith('-content') && !t.endsWith('-views')
    }) as HTMLElement[]
    if (!cards.length) return null
    const rects = cards.map((c) => c.getBoundingClientRect())
    const gaps = rects.slice(1).map((r, i) => Math.round(r.left - rects[i].right))
    const wrapperRect = wrapper.getBoundingClientRect()
    // Панель вкладок (карточка-контейнер с рамкой) — первый ребёнок обёртки.
    const panel = wrapper.firstElementChild as HTMLElement | null
    const panelRect = panel ? panel.getBoundingClientRect() : wrapperRect
    // Вся инфа первой видимой карточки (заголовок + локация) должна быть в пределах
    // и обёртки, и панели — т.е. низ карточки не срезан никаким overflow.
    const contentFullyVisible = rects.every(
      (r) => r.bottom <= wrapperRect.bottom + 1 && r.bottom <= panelRect.bottom + 1,
    )
    return {
      count: cards.length,
      widths: rects.map((r) => Math.round(r.width)),
      gaps,
      cardTop: Math.round(rects[0].top),
      cardBottom: Math.round(rects[0].bottom),
      wrapperBottom: Math.round(wrapperRect.bottom),
      panelBottom: Math.round(panelRect.bottom),
      contentFullyVisible,
    }
  }, railTestId)
}

test.describe('Recommendations tabs rails (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('all tab rails have 12px gaps and fully visible cards', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent)
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('recommendations_visible', 'true')
        sessionStorage.removeItem('weekly_highlights_collapsed')
        sessionStorage.removeItem('personalization_collapsed')
      } catch {
        // noop
      }
    })
    await mockCollections(page)

    await gotoWithRetry(page, '/travelsby')
    const wrapper = page.locator(tid('recommendations-list-header'))
    await expect(wrapper).toBeVisible({ timeout: 45_000 })
    await wrapper.scrollIntoViewIfNeeded()

    const results: Record<string, RailProbe | null> = {}

    // 1) Подборка месяца — эталон (активна по умолчанию)
    await expect(page.locator(tid('weekly-highlights-rail'))).toBeVisible({ timeout: 30_000 })
    results.highlights = await probeRail(page, 'weekly-highlights-rail')
    await wrapper.screenshot({ path: `${OUT_DIR}/tab-highlights.png` })

    // 2) Хочу поехать
    await page.getByRole('tab', { name: 'Хочу поехать' }).click()
    await expect(page.locator(tid('recommendations-favorites-rail'))).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Смотреть все').first()).toBeVisible()
    results.favorites = await probeRail(page, 'recommendations-favorites-rail')
    await wrapper.screenshot({ path: `${OUT_DIR}/tab-favorites.png` })

    // 3) История
    await page.getByRole('tab', { name: 'История' }).click()
    await expect(page.locator(tid('recommendations-history-rail'))).toBeVisible({ timeout: 30_000 })
    results.history = await probeRail(page, 'recommendations-history-rail')
    await wrapper.screenshot({ path: `${OUT_DIR}/tab-history.png` })

    // 4) Рекомендации
    await page.getByRole('tab', { name: 'Рекомендации' }).click()
    await expect(page.locator(tid('personalized-recommendations-rail'))).toBeVisible({ timeout: 30_000 })
    results.recommendations = await probeRail(page, 'personalized-recommendations-rail')
    await wrapper.screenshot({ path: `${OUT_DIR}/tab-recommendations.png` })

    console.log('[probe results]', JSON.stringify(results, null, 2))

    for (const [tab, probe] of Object.entries(results)) {
      expect(probe, `${tab}: rail probe`).not.toBeNull()
      const p = probe as RailProbe
      expect(p.count, `${tab}: card count`).toBeGreaterThanOrEqual(3)
      for (const gap of p.gaps) {
        expect(Math.abs(gap - 12), `${tab}: gap ${gap} ≠ 12 (gaps=${p.gaps.join(',')})`).toBeLessThanOrEqual(1)
      }
      expect(p.contentFullyVisible, `${tab}: card bottom clipped (card ${p.cardBottom} vs wrapper ${p.wrapperBottom} / panel ${p.panelBottom})`).toBe(true)
    }
  })
})
