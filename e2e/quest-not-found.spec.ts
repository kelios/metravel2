import type { Page, Route } from '@playwright/test'
import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #2896: `/quests/<неизвестный slug>` отвечал пустой страницей — шапка, крошки и
 * нижняя навигация без текста. Документ и раньше был 404 (оболочка
 * `+not-found.html`), но клиент после гидратации не доходил до терминального
 * состояния: редирект в каталог не срабатывал, а в SSR-режиме запрос данных
 * маршрута падал. Теперь неизвестный адрес — экран «Такого квеста нет» со
 * ссылкой на каталог и популярными квестами, а alias квеста без id ведёт на его
 * канонический адрес.
 */

const CITY = { id: 11, name: 'Гродно', lat: 53.68, lng: 23.82 }

const catalogEntry = (questId: string, title: string, completions: number) => ({
  id: 7_000 + completions,
  quest_id: questId,
  title,
  points: 5,
  city_id: String(CITY.id),
  city_name: CITY.name,
  country_id: 'BY',
  country_name: 'Беларусь',
  country_code: 'BY',
  lat: CITY.lat,
  lng: CITY.lng,
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  completions_count: completions,
  views_count: completions * 10,
  is_completed_by_me: false,
  first_completer: null,
})

const catalog = [
  catalogEntry('grodno-royal', 'Гродно: королевский город над Неманом', 9),
  catalogEntry('grodno-old-town', 'Гродно: старый город', 3),
]

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

/** Детерминированный каталог: экран «не найдено» берёт из него популярные квесты. */
const mockCatalog = async (page: Page) => {
  await page.route((url) => /\/api\/quests\/?$/.test(url.pathname), (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return fulfillJson(route, { results: catalog, next: null, count: catalog.length })
  })
  await page.route((url) => /\/api\/quests\/stats\/?$/.test(url.pathname), (route) =>
    fulfillJson(route, { players_count: 0 }))
}

test.describe('Неизвестный адрес раздела квестов (#2896)', () => {
  test('@smoke /quests/<неизвестный slug> отвечает 404 и показывает экран «Такого квеста нет» с каталогом', async ({ page }) => {
    await preacceptCookies(page)
    await mockCatalog(page)

    const response = await page.goto('/quests/this-quest-does-not-exist-123', { waitUntil: 'domcontentloaded' })
    expect(response?.status(), 'документ на неизвестный slug обязан быть 404').toBe(404)

    const screen = page.getByTestId('quest-not-found')
    await expect(screen).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Такого квеста нет')).toBeVisible()
    await expect(page.getByText(/this-quest-does-not-exist-123/)).toBeVisible()
    await expect(page.getByTestId('quest-not-found-popular')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Гродно: королевский город над Неманом')).toBeVisible()

    await page.getByTestId('quest-not-found-catalog').click()
    await expect(page).toHaveURL(/\/quests\/?(\?.*)?$/, { timeout: 30_000 })
  })

  test('alias квеста без id уходит на канонический адрес квеста', async ({ page }) => {
    await preacceptCookies(page)
    await mockCatalog(page)

    await page.goto('/quests/grodno-royal', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/quests/${CITY.id}/grodno-royal`), { timeout: 60_000 })
  })
})
