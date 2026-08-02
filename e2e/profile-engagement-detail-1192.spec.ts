import path from 'node:path'
import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

// #1192 — детализация «кто и какой маршрут» из карточек статистики автора.
// Данные author-only и приватные, поэтому сценарий гоняется на фикстурах
// контракта #1191 (GET /api/travels/author-engagement/), а не на живом аккаунте.

const SCREENSHOTS_DIR = path.join(__dirname, '__screenshots__', 'profile-engagement-detail-1192')

const TRAVEL = {
  id: 682,
  name: 'Гарц за три дня',
  slug: 'garz',
  url: '/travels/garz',
  travel_image_thumb_url: '',
}

const buildEngagementItem = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `favorites:${index}`,
  metric: 'favorites',
  occurred_at: `2026-07-${String(10 + index).padStart(2, '0')}T10:00:00Z`,
  identity_hidden: false,
  user: {
    id: 100 + index,
    first_name: 'Путешественник',
    last_name: `№${index}`,
    avatar: null,
  },
  travel: TRAVEL,
  ...overrides,
})

const PAGE_1 = {
  count: 3,
  total: 3,
  current_page: 1,
  per_page: 2,
  next: 'https://example.test/api/travels/author-engagement/?metric=favorites&page=2',
  results: [
    buildEngagementItem(1),
    buildEngagementItem(2, {
      identity_hidden: true,
      user: { id: null, first_name: '', last_name: '', avatar: null },
    }),
  ],
}

const PAGE_2 = {
  count: 3,
  total: 3,
  current_page: 2,
  per_page: 2,
  next: null,
  results: [buildEngagementItem(3)],
}

interface EngagementCalls {
  urls: string[]
}

async function mockApis(page: import('@playwright/test').Page, calls: EngagementCalls) {
  // Catch-all: любой неописанный GET отвечает пустым объектом, чтобы профиль
  // не падал в бесконечный лоадер из-за незамоканных ручек.
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('**/api/subscriptions/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/achievements/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Список маршрутов автора со сводкой метрик — из неё рисуются карточки статистики.
  await page.route('**/api/travels/?**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        favorites_count: 3,
        wishlist_count: 2,
        visited_count: 1,
        planned_count: 4,
        data: [
          {
            ...TRAVEL,
            publish: 1,
            moderation: 1,
            favorites_count: 3,
            wishlist_count: 2,
            visited_count: 1,
            planned_count: 4,
          },
        ],
      }),
    })
  })

  // Контракт #1191. Регистрируется последним — Playwright берёт самый свежий матч.
  await page.route('**/api/travels/author-engagement/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const url = route.request().url()
    calls.urls.push(url)
    const isSecondPage = /[?&]page=2\b/.test(url)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isSecondPage ? PAGE_2 : PAGE_1),
    })
  })
}

async function setup(page: import('@playwright/test').Page, calls: EngagementCalls) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await mockApis(page, calls)
  await preacceptCookies(page)
}

async function openStats(page: import('@playwright/test').Page) {
  const tab = page.getByRole('tab', { name: /Статистика/i })
  await tab.waitFor({ state: 'visible', timeout: 20_000 })
  await tab.click()
}

async function openSavedMetric(page: import('@playwright/test').Page) {
  const card = page.getByRole('button', { name: 'Сохранили: 3' })
  await expect(async () => {
    await card.scrollIntoViewIfNeeded()
    await card.click()
    await expect(page.getByTestId('profile-engagement-detail')).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 40_000 })
}

test.describe('#1192 author engagement detail', () => {
  test('desktop — карточка метрики раскрывает «кто и какой маршрут»', async ({ page }) => {
    const calls: EngagementCalls = { urls: [] }
    await page.setViewportSize({ width: 1280, height: 900 })
    await setup(page, calls)
    await gotoWithRetry(page, '/profile')
    await page.waitForLoadState('networkidle').catch(() => {})
    await openStats(page)
    await openSavedMetric(page)

    const panel = page.getByTestId('profile-engagement-detail')
    await expect(panel.getByText('Кто сохранил ваши маршруты')).toBeVisible()
    await expect(panel.getByText('Путешественник №1')).toBeVisible()
    await expect(panel.getByText('Гарц за три дня').first()).toBeVisible()
    await expect(panel.getByText('11 июля 2026 г.')).toBeVisible()
    await expect(panel.getByText('Всего отметок: 3')).toBeVisible()

    // Приватность: заблокированный пользователь не раскрывает имя и не кликается.
    await expect(panel.getByText('Скрытый пользователь')).toBeVisible()
    await expect(panel.getByText('Профиль недоступен из-за блокировки')).toBeVisible()

    // Запрос идёт строго по контракту #1191, без произвольного автора.
    expect(calls.urls.length).toBeGreaterThan(0)
    expect(calls.urls[0]).toContain('metric=favorites')
    expect(calls.urls[0]).not.toContain('author_id')
    expect(calls.urls[0]).not.toContain('user_id')

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'desktop-detail.png'), fullPage: false })
  })

  test('desktop — «Показать ещё» подгружает следующую страницу', async ({ page }) => {
    const calls: EngagementCalls = { urls: [] }
    await page.setViewportSize({ width: 1280, height: 900 })
    await setup(page, calls)
    await gotoWithRetry(page, '/profile')
    await page.waitForLoadState('networkidle').catch(() => {})
    await openStats(page)
    await openSavedMetric(page)

    const panel = page.getByTestId('profile-engagement-detail')
    const loadMore = page.getByTestId('engagement-detail-load-more')
    await expect(loadMore).toBeVisible()
    await loadMore.click()

    await expect(panel.getByText('Путешественник №3')).toBeVisible({ timeout: 20_000 })
    expect(calls.urls.some((url) => /[?&]page=2\b/.test(url))).toBe(true)
    await expect(page.getByTestId('engagement-detail-load-more')).toHaveCount(0)
  })

  test('desktop — строка маршрута ведёт на сам маршрут', async ({ page }) => {
    const calls: EngagementCalls = { urls: [] }
    await page.setViewportSize({ width: 1280, height: 900 })
    await setup(page, calls)
    await gotoWithRetry(page, '/profile')
    await page.waitForLoadState('networkidle').catch(() => {})
    await openStats(page)
    await openSavedMetric(page)

    await page.getByLabel('Открыть маршрут: Гарц за три дня').first().click()
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toContain('/travels/garz')
  })

  test('mobile 390 — та же панель и те же данные', async ({ page }) => {
    const calls: EngagementCalls = { urls: [] }
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, calls)
    await gotoWithRetry(page, '/profile')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await openStats(page)
    await openSavedMetric(page)

    const panel = page.getByTestId('profile-engagement-detail')
    await expect(panel.getByText('Кто сохранил ваши маршруты')).toBeVisible()
    await expect(panel.getByText('Путешественник №1')).toBeVisible()
    await expect(panel.getByText('Гарц за три дня').first()).toBeVisible()
    await expect(panel.getByText('Скрытый пользователь')).toBeVisible()

    // Панель не должна вылезать за вьюпорт на мобильном.
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThanOrEqual(390)

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-detail.png'), fullPage: false })
  })

  test('mobile 390 — пустая выборка объясняется текстом, а не пустотой', async ({ page }) => {
    const calls: EngagementCalls = { urls: [] }
    await page.setViewportSize({ width: 390, height: 844 })
    await ensureAuthedStorageFallback(page)
    await mockFakeAuthApis(page)
    await mockApis(page, calls)
    await page.route('**/api/travels/author-engagement/**', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, total: 0, next: null, results: [] }),
      })
    })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/profile')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await openStats(page)
    await openSavedMetric(page)

    await expect(page.getByTestId('engagement-detail-empty')).toBeVisible()
    await expect(page.getByText('Пока никто не отметил')).toBeVisible()
  })
})
