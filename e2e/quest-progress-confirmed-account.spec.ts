import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1462: окно между подтверждением почты и первой проверкой авторизации. Экран
 * подтверждения поднимал только флаг `isAuthenticated`, а `userId` в сторе
 * оставался `null` — ключ локальной копии прогресса квеста (#1456) вырождался в
 * общий `{storage_key}__u:pending`, одинаковый для всех, кто попал в это окно.
 * Два новых аккаунта на одном устройстве делили одну запись.
 *
 * Тест обязан идти по SPA-навигации: перезагрузка страницы «лечит» дефект, потому
 * что `checkAuthentication` поднимает id из localStorage, куда его положил
 * `confirmAccount`. Поэтому после подтверждения переходим на квест кликами.
 */

const QUEST_ID = 'e2e-confirmed-account-quest'
const QUEST_TITLE = 'E2E-квест подтверждённого аккаунта'
const CONFIRMED_USER_ID = '4242'
const PENDING_KEY = `${QUEST_ID}__u:pending`
const CONFIRMED_KEY = `${QUEST_ID}__u${CONFIRMED_USER_ID}`
const FOREIGN_ANSWER = 'ответ предыдущего аккаунта'
const OWN_ANSWER = 'ответ подтверждённого аккаунта'

const questCity = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

const buildStep = (order: number) => ({
  id: order,
  step_id: `confirmed-step-${order}`,
  title: `Точка ${order}`,
  location: 'Минск',
  story: 'Детерминированный шаг для проверки изоляции прогресса.',
  task: 'Введите любое слово.',
  hint: 'Подойдёт любой непустой ответ.',
  answer_pattern: { type: 'any_text', value: { min_length: 1 } },
  lat: questCity.lat,
  lng: questCity.lng,
  maps_url: 'https://www.openstreetmap.org/?mlat=53.9023&mlon=27.5619',
  image_url: null,
  order,
  is_intro: false,
  country_code: questCity.country_code,
})

const questBundle = {
  id: 91_020,
  quest_id: QUEST_ID,
  title: QUEST_TITLE,
  cover_url: null,
  steps: [buildStep(1), buildStep(2)],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
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

/** Метаданные каталога: карточка, по которой уходим на квест SPA-переходом. */
const questMeta = {
  id: questBundle.id,
  quest_id: QUEST_ID,
  title: QUEST_TITLE,
  points: 2,
  city_id: String(questCity.id),
  city_name: questCity.name,
  country_id: '1',
  country_name: 'Беларусь',
  country_code: questCity.country_code,
  lat: questCity.lat,
  lng: questCity.lng,
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

/** Запись, оставшаяся на устройстве от предыдущего аккаунта в том же окне. */
const leftoverPendingRecord = {
  index: 2,
  unlocked: 2,
  answers: { 'confirmed-step-1': FOREIGN_ANSWER, 'confirmed-step-2': FOREIGN_ANSWER },
  attempts: {},
  hints: {},
  showMap: true,
  completed: true,
  skipped: {},
  earlyFinish: false,
  updatedAt: 1_760_000_000_000,
  answeredAt: { 'confirmed-step-1': 1_760_000_000_000, 'confirmed-step-2': 1_760_000_000_000 },
}

const serverProgress = {
  id: 777,
  quest: questBundle.id,
  quest_id: QUEST_ID,
  current_index: 0,
  unlocked_index: 0,
  answers: {},
  attempts: {},
  hints: {},
  show_map: true,
  completed: false,
  updated_at: '2026-08-01T00:00:00Z',
}

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

const mockApis = async (page: Page) => {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname.includes('/user/confirm-registration/')) {
      return fulfillJson(route, {
        userToken: 'e2e-confirm-token',
        userName: 'E2E Confirmed',
        userId: Number(CONFIRMED_USER_ID),
      })
    }
    if (pathname.includes('/user/me/verifications/')) return fulfillJson(route, { ok: true })
    if (/\/user\/\d+\/profile\//.test(pathname)) {
      return fulfillJson(route, {
        id: Number(CONFIRMED_USER_ID),
        name: 'E2E Confirmed',
        email: 'e2e-confirmed@example.com',
        is_premium: false,
      })
    }
    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) return fulfillJson(route, questBundle)
    if (pathname.includes(`/quest-progress/quest/${QUEST_ID}/`)) return fulfillJson(route, serverProgress)
    if (/\/quests\/$/.test(pathname)) return fulfillJson(route, { results: [questMeta], next: null })
    if (pathname.includes('/reviews/')) return fulfillJson(route, [])
    if (/\/quest-progress\/\d+\/$/.test(pathname)) {
      let body: any = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      return fulfillJson(route, { ...serverProgress, ...(body ?? {}) })
    }
    return fulfillJson(route, {})
  })
}

const seedDevice = async (page: Page) => {
  await page.addInitScript(
    ({ pendingKey, leftover }) => {
      try {
        window.localStorage.setItem(
          'metravel_action_consents_v1',
          JSON.stringify({ quest_start: { version: '1', date: new Date().toISOString() } }),
        )
        window.localStorage.setItem(pendingKey, JSON.stringify(leftover))
      } catch {
        // ignore
      }
    },
    { pendingKey: PENDING_KEY, leftover: leftoverPendingRecord },
  )
}

// Стартуем разлогиненными: сессию создаёт именно подтверждение почты.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Quest progress after email confirmation (#1462)', () => {
  test('свежеподтверждённый аккаунт не подхватывает запись предыдущего из окна подтверждения', async ({ page }) => {
    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockApis(page)
    await seedDevice(page)

    await page.goto('/accountconfirmation?hash=e2e-confirm-hash', { waitUntil: 'domcontentloaded' })

    // Экран подтверждения уводит на главную SPA-переходом: страница не
    // перезагружается, поэтому стор остаётся ровно в том состоянии, которое
    // выставило подтверждение.
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/')

    await page.getByRole('link', { name: 'Квесты', exact: true }).first().click()
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe('/quests')

    await page.getByTestId(`quest-card-${QUEST_ID}`).click()
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60_000 })
      .toBe(`/quests/${questCity.id}/${QUEST_ID}`)

    // Чужой записи не видно: ни ответов, ни финала предыдущего аккаунта.
    const startButton = page.getByRole('button', { name: 'Начать квест' })
    await expect(startButton).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(FOREIGN_ANSWER, { exact: false })).toHaveCount(0)
    await expect(page.getByText('Квест завершён.', { exact: true })).toHaveCount(0)

    await startButton.click()

    const answer = page.getByRole('textbox').first()
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await expect(answer).toHaveValue('')

    await answer.fill(OWN_ANSWER)
    await page.getByRole('button', { name: 'Проверить ответ' }).click()

    await expect
      .poll(
        () => page.evaluate((key) => window.localStorage.getItem(key), CONFIRMED_KEY),
        { timeout: 30_000 },
      )
      .toContain(OWN_ANSWER)

    const storage = await page.evaluate(
      ({ pendingKey, confirmedKey }) => ({
        pending: window.localStorage.getItem(pendingKey),
        confirmed: window.localStorage.getItem(confirmedKey),
      }),
      { pendingKey: PENDING_KEY, confirmedKey: CONFIRMED_KEY },
    )

    // Пишем под ключом с числовым id; общая ячейка окна подтверждения не тронута.
    const ownRecord = JSON.parse(storage.confirmed as string)
    expect(ownRecord.answers['confirmed-step-1']).toBe(OWN_ANSWER)
    expect(ownRecord.answers['confirmed-step-2']).toBeUndefined()
    expect(ownRecord.completed).not.toBe(true)
    expect(JSON.parse(storage.pending as string)).toMatchObject({ completed: true })
  })
})
