import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1632: официальный пропуск точки и досрочный финиш обязаны доезжать до сервера.
 *
 * Приёмка 31.08.2026 отказала карточке по наблюдению «нажал „Пропустить шаг“ —
 * `skipped` пустой». Нажата была отложенная ссылка (`skipStep`), которая точку с
 * гейта финала не снимает по замыслу (#1633), поэтому пустая карта там —
 * ожидаемое поведение, а не дефект переноса. Этот тест разводит оба действия и
 * ловит РЕАЛЬНОЕ тело PATCH:
 *   - «Пропустить точку» (далёкая точка) → `skipped: {<step>: true}`;
 *   - «Завершить квест здесь» → `early_finish: true`;
 *   - отложенная ссылка «Пропустить шаг» → `skipped` остаётся пустым, но курсор
 *     всё равно уезжает на сервер (PATCH уходит).
 *
 * Квест фиксируется мок-бандлом: далёкая точка нужна детерминированная, а на
 * живом контенте она зависит от геометрии маршрута.
 */

const QUEST_ID = 'e2e-skip-sync-quest'
const QUEST_TITLE = 'E2E-квест переноса пропусков'
const PROGRESS_ID = 90_632

const questCity = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

/**
 * Перегоны маршрута: 100 м, 5000 м, 100 м. Медиана перегона — 100 м, поэтому
 * третья точка проходит оба порога «далеко» (≥ 800 м и ≥ 3 медиан) и получает
 * блок с официальным пропуском. Остальные точки остаются обычными.
 *
 * Четвёртая точка не декорация. Без неё медиана двух перегонов стала бы 2,5 км,
 * тройной порог ушёл бы за 7 км и блока не было бы вовсе. Стоит она за тем же
 * пятикилометровым перегоном: расстояние считается от последней отвеченной
 * точки, поэтому «далеко» оказывается весь остаток маршрута — только так в
 * блоке появляется «Завершить квест здесь».
 */
const STEP_COORDS: { id: string; lat: number; lng: number }[] = [
  { id: 'sync-step-1', lat: 53.9023, lng: 27.5619 },
  { id: 'sync-step-2', lat: 53.9032, lng: 27.5619 },
  { id: 'sync-step-3', lat: 53.9482, lng: 27.5619 },
  { id: 'sync-step-4', lat: 53.9491, lng: 27.5619 },
]

const FAR_STEP_ID = STEP_COORDS[2].id

const buildStep = (index: number) => {
  const point = STEP_COORDS[index]
  return {
    id: index + 1,
    step_id: point.id,
    title: `Точка ${index + 1}`,
    location: 'Минск',
    story: 'Детерминированный шаг для проверки переноса пропусков.',
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
  id: 91_632,
  quest_id: QUEST_ID,
  title: QUEST_TITLE,
  cover_url: null,
  steps: STEP_COORDS.map((_, index) => buildStep(index)),
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

type ServerRow = {
  id: number
  quest: number
  quest_id: string
  current_index: number
  unlocked_index: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  show_map: boolean
  completed: boolean
  skipped: Record<string, boolean>
  early_finish: boolean
  updated_at: string
}

const freshServerRow = (): ServerRow => ({
  id: PROGRESS_ID,
  quest: questBundle.id,
  quest_id: QUEST_ID,
  current_index: 0,
  unlocked_index: 0,
  answers: {},
  attempts: {},
  hints: {},
  show_map: true,
  completed: false,
  skipped: {},
  early_finish: false,
  updated_at: '2026-08-01T00:00:00Z',
})

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

/**
 * Мокаются только эндпойнты квеста. Авторизация остаётся настоящей (сессия из
 * `storageState`, cookie), иначе `saveProgress` молча выходит и PATCH не уходит
 * вовсе — тест перестал бы проверять именно то, ради чего написан.
 *
 * Строка прогресса живая: PATCH её обновляет, чтобы следующий
 * `fetchOrCreateProgress` перед слиянием видел то же, что и сервер, — иначе
 * клиент слал бы один и тот же снапшот по кругу.
 */
const mockApis = async (page: Page, patched: Record<string, unknown>[]) => {
  let serverRow = freshServerRow()

  await page.route(`**/api/quests/by-quest-id/${QUEST_ID}/**`, (route) => fulfillJson(route, questBundle))
  await page.route(`**/api/quest-progress/quest/${QUEST_ID}/**`, (route) => fulfillJson(route, serverRow))
  await page.route('**/api/quest-progress/*/', (route) => {
    let body: Record<string, unknown> | null = null
    try {
      body = route.request().postDataJSON()
    } catch {
      body = null
    }
    if (body) {
      patched.push(body)
      serverRow = { ...serverRow, ...(body as Partial<ServerRow>), updated_at: new Date().toISOString() }
    }
    return fulfillJson(route, serverRow)
  })
  // Телеметрия попыток уходит на каждом переходе между точками и адресована
  // числовому id мок-квеста, которого в БД нет. Без заглушки спека пишет живой
  // POST в ту базу, на которую нацелен прогон, — тела ответа клиенту хватает
  // любого 2xx, событие после него просто выбрасывается из очереди.
  await page.route('**/api/quest-answer-attempts/bulk/**', (route) =>
    fulfillJson(route, { accepted: 0, duplicates: 0, rejected: 0 }),
  )
}

const seedConsent = async (page: Page) => {
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
}

/** Сессия приходит из `storageState` глобального сетапа — реальная cookie. */
const openQuest = async (page: Page, patched: Record<string, unknown>[]) => {
  await preacceptCookies(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockApis(page, patched)
  await seedConsent(page)

  await page.goto(`/quests/${questCity.id}/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
  const startButton = page.getByRole('button', { name: 'Начать квест' })
  await expect(startButton).toBeVisible({ timeout: 60_000 })
  await startButton.click()
}

/**
 * Отвечает на текущую точку и дожидается, пока счётчик заданий не увеличится:
 * визард переключает шаг сам, и без явного ожидания следующий `fill` попадает в
 * поле уже пройденной точки.
 */
const answerCurrentStep = async (page: Page, value: string, completedAfter: number) => {
  const answer = page.getByRole('textbox').first()
  await expect(answer).toBeVisible({ timeout: 30_000 })
  await answer.fill(value)
  await page.getByTestId('quest-step-check').click()
  await expect(page.getByText(`Задания: ${completedAfter} / ${STEP_COORDS.length}`)).toBeVisible({
    timeout: 30_000,
  })
}

const lastPatch = (patched: Record<string, unknown>[]) => patched[patched.length - 1]

/**
 * Куда обязан встать курсор после отложенного пропуска первой вопросной точки.
 * Нулевой индекс занимает стартовая карточка (визард всегда подставляет intro),
 * поэтому первая точка маршрута — 1, а пропуск уводит на 2. Точное значение, а
 * не «больше нуля»: сдвиг индексации — это как раз та поломка, ради которой
 * курсор здесь и проверяется.
 */
const CURSOR_AFTER_POSTPONE = 2

test.describe('Перенос пропуска и досрочного финиша на сервер (#1632)', () => {
  test('официальный пропуск далёкой точки уходит в PATCH непустой картой skipped', async ({ page }) => {
    const patched: Record<string, unknown>[] = []
    await openQuest(page, patched)

    await answerCurrentStep(page, 'первый ответ', 1)
    await answerCurrentStep(page, 'второй ответ', 2)

    // Третья точка за пятикилометровым перегоном — блок официального пропуска.
    await expect(page.getByTestId('quest-step-far-notice')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('quest-step-far-skip').click()

    await expect
      .poll(() => (lastPatch(patched)?.skipped as Record<string, boolean> | undefined) ?? {}, {
        timeout: 30_000,
      })
      .toEqual({ [FAR_STEP_ID]: true })
  })

  test('«Завершить квест здесь» уходит в PATCH флагом early_finish', async ({ page }) => {
    const patched: Record<string, unknown>[] = []
    await openQuest(page, patched)

    await answerCurrentStep(page, 'первый ответ', 1)
    await answerCurrentStep(page, 'второй ответ', 2)

    await expect(page.getByTestId('quest-step-far-notice')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('quest-step-finish-here').click()

    await expect
      .poll(() => lastPatch(patched)?.early_finish ?? false, { timeout: 30_000 })
      .toBe(true)
  })

  test('отложенная ссылка «Пропустить шаг» курсор на сервер шлёт, а точку с гейта не снимает', async ({ page }) => {
    const patched: Record<string, unknown>[] = []
    await openQuest(page, patched)

    // Ссылка живёт рядом с подсказкой на самой первой вопросной точке. `exact`
    // здесь обязателен: у приглашения #1430 («Не сходится? Пропустить шаг и идти
    // дальше») accessible name содержит ту же подстроку, но зовёт другой
    // обработчик — `skipStuckStep`, который точку с гейта как раз снимает.
    await page.getByRole('button', { name: 'Пропустить шаг', exact: true }).click()

    // Курсор уехал вперёд — значит серверу есть что записать, PATCH обязан уйти.
    await expect
      .poll(() => lastPatch(patched)?.current_index ?? 0, { timeout: 30_000 })
      .toBe(CURSOR_AFTER_POSTPONE)
    // Но точка осталась обязательной: карта пропусков пуста (#1633 объясняет это игроку).
    expect(lastPatch(patched)?.skipped ?? {}).toEqual({})
  })
})
