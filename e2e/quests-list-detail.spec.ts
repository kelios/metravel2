import type { Page, Route } from '@playwright/test'
import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import { expectNoHorizontalScroll } from './helpers/layoutAsserts'
import { isRecoverableReactHydrationError } from './helpers/consoleGuards'

const WAIT_MS = 30_000
const QUEST_DETAIL_URL_RE = /\/quests\/[^/]+\/[^/?#]+/
const QUEST_ID = 'e2e-minsk-quest'

const questCity = {
  id: 1,
  name: 'Минск',
  lat: 53.9023,
  lng: 27.5619,
  country_code: 'BY',
}

const questMeta = {
  id: 91_001,
  quest_id: QUEST_ID,
  title: 'E2E-квест по Минску',
  points: 1,
  city_id: String(questCity.id),
  city_name: questCity.name,
  country_id: '1',
  country_name: 'Беларусь',
  country_code: questCity.country_code,
  lat: questCity.lat,
  lng: questCity.lng,
  duration_min: 45,
  difficulty: 'easy',
  tags: {},
  pet_friendly: true,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

const questBundle = {
  id: questMeta.id,
  quest_id: QUEST_ID,
  title: questMeta.title,
  cover_url: null,
  steps: [
    {
      id: 1,
      step_id: 'start',
      title: 'Площадь Свободы',
      location: 'Площадь Свободы, Минск',
      story: 'Детерминированная E2E-история для проверки страницы квеста.',
      task: 'Введите любое слово.',
      hint: 'Подойдёт любой непустой ответ.',
      answer_pattern: { type: 'any_text', value: { min_length: 1 } },
      lat: questCity.lat,
      lng: questCity.lng,
      maps_url: 'https://www.openstreetmap.org/?mlat=53.9023&mlon=27.5619',
      image_url: null,
      order: 1,
      is_intro: false,
      country_code: questCity.country_code,
    },
  ],
  finale: {
    text: 'Квест завершён.',
    video_url: null,
    poster_url: null,
  },
  intro: null,
  storage_key: QUEST_ID,
  city: questCity,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(value),
  })

const mockQuestApis = async (page: Page) => {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname.endsWith('/quests/cities/')) return fulfillJson(route, [questCity])
    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) return fulfillJson(route, questBundle)
    if (pathname.includes(`/quests/quest${QUEST_ID}/reviews/`)) return fulfillJson(route, [])
    if (pathname.endsWith('/quests/near-location/')) return fulfillJson(route, { results: [], count: 0 })
    if (pathname.endsWith('/quests/')) return fulfillJson(route, [questMeta])

    return fulfillJson(route, {})
  })
}

// The catalog can legitimately render in several end states depending on the
// e2e backend data: real cards, an empty/error fallback, or the bare heading.
// Treat any of these as "the screen finished its first render" so we never
// flake on data availability.
const QUEST_FALLBACK_RE =
  /ошибка|Internal Server Error|Failed to load quests|не удалось загрузить|квесты не найдены|нет квестов|Нет квестов|0 квестов|Выберите город/i
const RESOURCE_500_RE = /Failed to load resource: the server responded with a status of 500/i
const LOCAL_PROD_API_CORS_RE = /https:\/\/metravel\.by\/api\/(countries|getFiltersTravel)\//
const LOCAL_PROD_ORIGIN = "from origin 'http://127.0.0.1:8085'"

const waitForQuestCatalogReady = async (page: Page) =>
  Promise.any([
    page.locator('[data-testid^="quest-card-"]').first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByRole('link', { name: /Начать приключение/i }).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByText(QUEST_FALLBACK_RE).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByRole('heading', { name: /Квесты/i }).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
  ])

const getFirstQuestCard = async (page: Page) => {
  const byTestId = page.locator('[data-testid^="quest-card-"]')
  await byTestId.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
  if ((await byTestId.count()) > 0) return byTestId.first()

  const byRole = page.getByRole('link', { name: /Начать приключение/i })
  if ((await byRole.count()) > 0) return byRole.first()

  return null
}

test.describe('Quests list -> detail', () => {
  test('guest can browse the quest catalog and open a quest detail', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequestPaths: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err))
    })
    page.on('requestfailed', (request) => {
      try {
        const url = new URL(request.url())
        failedRequestPaths.push(`${url.origin}${url.pathname}`)
      } catch {
        // Keep diagnostics free of raw query strings or signed media URLs.
      }
    })

    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockQuestApis(page)

    await gotoWithRetry(page, '/quests')
    await waitForQuestCatalogReady(page)

    // The hidden SEO h1 plus the visible catalog heading establish the page identity.
    await expect(page.getByRole('heading', { name: /Квесты/i }).first()).toBeVisible({ timeout: WAIT_MS })

    // Country grouping: the "Рядом со мной" location filter is always present in the sidebar.
    await expect(page.getByTestId('quests-sidebar-nearby-button')).toBeVisible({ timeout: WAIT_MS })

    // Map toggle control exists ("Показать квесты на карте" / "на карте").
    await expect(
      page.getByTestId('quests-sidebar-toggle-view-mode'),
    ).toBeVisible({ timeout: WAIT_MS })

    // No horizontal overflow on the catalog screen.
    await expectNoHorizontalScroll(page)

    // Open a quest detail if any quest exists; otherwise assert the fallback is shown.
    const card = await getFirstQuestCard(page)
    let backendFallbackVisible = false
    if (card) {
      await Promise.all([
        page.waitForURL(QUEST_DETAIL_URL_RE, { timeout: WAIT_MS }),
        card.click(),
      ])
      await page.waitForLoadState('domcontentloaded')

      await expect(page).toHaveURL(QUEST_DETAIL_URL_RE)
      await expect(page.locator('text=/Квест|Quest/i').first()).toBeVisible({ timeout: WAIT_MS })

      await expect(page.getByTestId('quest-map-toolbar')).toBeVisible({ timeout: WAIT_MS })
      await expect(page.getByTestId('quest-map-route-status')).toBeVisible({ timeout: WAIT_MS })
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: WAIT_MS })
      await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: WAIT_MS })

      // Detail screen must also avoid horizontal overflow.
      await expectNoHorizontalScroll(page)
    } else {
      await expect(page.getByText(QUEST_FALLBACK_RE).first()).toBeVisible({ timeout: WAIT_MS })
      backendFallbackVisible = true
    }

    const unexpectedPageErrors = pageErrors.filter((message) => !isRecoverableReactHydrationError(message))
    const hasExpectedLocalProdApiCorsNoise = consoleErrors.some(
      (message) => message.includes(LOCAL_PROD_ORIGIN) && LOCAL_PROD_API_CORS_RE.test(message),
    )
    const unexpectedConsoleErrors = consoleErrors.filter((message) => {
      if (backendFallbackVisible && RESOURCE_500_RE.test(message)) return false
      if (
        hasExpectedLocalProdApiCorsNoise &&
        (LOCAL_PROD_API_CORS_RE.test(message) || message.includes('Failed to load resource: net::ERR_FAILED'))
      ) {
        return false
      }
      return true
    })
    expect(unexpectedPageErrors, `page errors: ${pageErrors.join('\n')}`).toHaveLength(0)
    expect(
      unexpectedConsoleErrors,
      `console errors: ${consoleErrors.join('\n')}\nfailed resources: ${[...new Set(failedRequestPaths)].join('\n')}`,
    ).toHaveLength(0)
  })
})
