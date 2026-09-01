import { expect, type Page, type Route } from '@playwright/test'

import { ensureAuthedStorageFallback, mockFakeAuthApis } from './auth'
import { preacceptCookies } from './navigation'

/**
 * Детерминированный квест для спек визарда.
 *
 * Живой контент для этих проверок не годится: далёкая точка, долг маршрута и
 * ширина ряда действий зависят от геометрии маршрута и числа точек, а они на
 * проде меняются. Каждая спека задаёт свои координаты и получает предсказуемый
 * маршрут.
 *
 * Авторизация локальная и детерминированная: feature-спеки не зависят от
 * `storageState` глобального сетапа и не вызывают внешний Google auth flow.
 * Без этой фикстуры визард уходит в гостевой режим (гейт после двух бесплатных
 * точек подменяет карточку шага), а `saveProgress` молча выходит и PATCH не уходит.
 */

export type QuestFixturePoint = { id: string; lat: number; lng: number }

export type QuestFixtureOptions = {
  questId: string
  questTitle: string
  /** Числовой id квеста: под ним уходит телеметрия попыток. */
  questNumericId: number
  progressId: number
  points: QuestFixturePoint[]
}

export type QuestFixture = {
  city: { id: number; name: string; lat: number; lng: number; country_code: string }
  stepTotal: number
  /** Тела всех исходящих PATCH прогресса в порядке отправки. */
  patched: Record<string, unknown>[]
  lastPatch: () => Record<string, unknown> | undefined
  open: (page: Page) => Promise<void>
  answerCurrentStep: (page: Page, value: string, completedAfter: number) => Promise<void>
}

const questCity = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

export function createQuestFixture(options: QuestFixtureOptions): QuestFixture {
  const { questId, questTitle, questNumericId, progressId, points } = options

  const buildStep = (index: number) => {
    const point = points[index]
    return {
      id: index + 1,
      step_id: point.id,
      title: `Точка ${index + 1}`,
      location: 'Минск',
      story: 'Детерминированный шаг спеки визарда.',
      task: 'Введите любое слово.',
      hint: 'Подойдёт любой непустой ответ.',
      answer_pattern: { type: 'any_text', value: { min_length: 1 } },
      lat: point.lat,
      lng: point.lng,
      maps_url: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}`,
      image_url: null,
      order: index + 1,
      is_intro: false,
      country_code: questCity.country_code,
    }
  }

  const questBundle = {
    id: questNumericId,
    quest_id: questId,
    title: questTitle,
    cover_url: null,
    steps: points.map((_, index) => buildStep(index)),
    finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
    intro: null,
    storage_key: questId,
    city: questCity,
    rating_avg: null,
    rating_count: 0,
    user_rating: null,
    completions_count: 0,
    is_completed_by_me: false,
    first_completer: null,
  }

  const patched: Record<string, unknown>[] = []

  const freshServerRow = () => ({
    id: progressId,
    quest: questNumericId,
    quest_id: questId,
    current_index: 0,
    unlocked_index: 0,
    answers: {} as Record<string, string>,
    attempts: {} as Record<string, number>,
    hints: {} as Record<string, boolean>,
    show_map: true,
    completed: false,
    skipped: {} as Record<string, boolean>,
    early_finish: false,
    updated_at: '2026-08-01T00:00:00Z',
  })

  const open = async (page: Page) => {
    let serverRow = freshServerRow()
    patched.length = 0

    await ensureAuthedStorageFallback(page, { userId: '1', userName: 'Quest E2E User' })
    await mockFakeAuthApis(page)
    await page.route(`**/api/quests/by-quest-id/${questId}/**`, (route) => fulfillJson(route, questBundle))
    await page.route(`**/api/quest-progress/quest/${questId}/**`, (route) => fulfillJson(route, serverRow))
    // Строка прогресса живая: PATCH её обновляет, чтобы следующий
    // `fetchOrCreateProgress` перед слиянием видел то же, что и сервер, — иначе
    // клиент слал бы один и тот же снапшот по кругу.
    await page.route('**/api/quest-progress/*/', (route) => {
      let body: Record<string, unknown> | null = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      if (body) {
        patched.push(body)
        serverRow = { ...serverRow, ...body, updated_at: new Date().toISOString() }
      }
      return fulfillJson(route, serverRow)
    })
    // Телеметрия попыток адресована числовому id мок-квеста, которого в БД нет:
    // без заглушки прогон писал бы живой POST в базу, на которую нацелен таргет.
    await page.route('**/api/quest-answer-attempts/bulk/**', (route) =>
      fulfillJson(route, { accepted: 0, duplicates: 0, rejected: 0 }),
    )

    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'metravel_action_consents_v1',
          JSON.stringify({ quest_start: { version: '1', date: new Date().toISOString() } }),
        )
      } catch {
        // ignore
      }
    })

    await page.goto(`/quests/${questCity.id}/${questId}`, { waitUntil: 'domcontentloaded' })
    const startButton = page.getByRole('button', { name: 'Начать квест' })
    await expect(startButton).toBeVisible({ timeout: 60_000 })
    await startButton.click()
  }

  /**
   * Отвечает на текущую точку и дожидается роста счётчика заданий: визард
   * переключает шаг сам, и без явного ожидания следующий `fill` попадает в поле
   * уже пройденной точки.
   */
  const answerCurrentStep = async (page: Page, value: string, completedAfter: number) => {
    const answer = page.getByRole('textbox').first()
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await answer.fill(value)
    await page.getByTestId('quest-step-check').click()
    await expect(page.getByText(`Задания: ${completedAfter} / ${points.length}`)).toBeVisible({
      timeout: 30_000,
    })
  }

  return {
    city: questCity,
    stepTotal: points.length,
    patched,
    lastPatch: () => patched[patched.length - 1],
    open,
    answerCurrentStep,
  }
}
