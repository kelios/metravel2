import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1633: ссылка «Пропустить шаг» откладывает точку, но с гейта финала её не
 * снимает. До правки игрок доходил до последней точки маршрута и упирался в
 * тупик: финала нет, объяснения нет, выхода нет — четыре прохождения из шести
 * за 24–28.08.2026 умерли ровно так.
 *
 * Приёмка 31.08 до этого экрана не дошла («прогон срывался на середине
 * маршрута»), поэтому пункты ТЗ про долг маршрута, возврат к отложенной точке и
 * досрочный финал остались непроверенными. Спека закрывает именно их.
 *
 * Маршрут фиксируется мок-бандлом с РОВНЫМИ перегонами (~100 м): блок далёкой
 * точки (#1432) не должен вмешиваться — он показывается вместо блока долга и
 * увёл бы проверку на другой механизм.
 */

const QUEST_ID = 'e2e-pending-debt-quest'
const QUEST_TITLE = 'E2E-квест долга маршрута'
const PROGRESS_ID = 90_633

const questCity = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

/** Четыре точки подряд через ~100 м: ни один перегон не проходит порог «далеко». */
const STEP_COORDS = [
  { id: 'debt-step-1', lat: 53.9023, lng: 27.5619 },
  { id: 'debt-step-2', lat: 53.9032, lng: 27.5619 },
  { id: 'debt-step-3', lat: 53.9041, lng: 27.5619 },
  { id: 'debt-step-4', lat: 53.905, lng: 27.5619 },
]

const POSTPONED_STEP_ID = STEP_COORDS[0].id
const STEP_TOTAL = STEP_COORDS.length

const buildStep = (index: number) => {
  const point = STEP_COORDS[index]
  return {
    id: index + 1,
    step_id: point.id,
    title: `Точка ${index + 1}`,
    location: 'Минск',
    story: 'Детерминированный шаг для проверки долга маршрута.',
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
  id: 91_633,
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

const freshServerRow = () => ({
  id: PROGRESS_ID,
  quest: questBundle.id,
  quest_id: QUEST_ID,
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

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

/**
 * Мокается только квест. Сессия остаётся настоящей: без неё визард уходит в
 * гостевой режим и гейт после двух бесплатных точек подменяет собой карточку
 * шага — то есть проверялся бы совсем другой экран.
 */
const mockApis = async (page: Page) => {
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
    if (body) serverRow = { ...serverRow, ...body, updated_at: new Date().toISOString() }
    return fulfillJson(route, serverRow)
  })
  // Телеметрия попыток адресована числовому id мок-квеста, которого в БД нет:
  // без заглушки прогон писал бы живой POST в базу, на которую нацелен таргет.
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

const openQuest = async (page: Page) => {
  await preacceptCookies(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockApis(page)
  await seedConsent(page)

  await page.goto(`/quests/${questCity.id}/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
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
  await expect(page.getByText(`Задания: ${completedAfter} / ${STEP_TOTAL}`)).toBeVisible({
    timeout: 30_000,
  })
}

/**
 * Откладывает первую точку ссылкой «Пропустить шаг» и доводит игрока до
 * последней точки маршрута — та самая позиция, в которой игроки застревали.
 * `exact: true` обязателен: приглашение #1430 «Не сходится? Пропустить шаг и
 * идти дальше» содержит ту же подстроку, но зовёт официальный пропуск.
 */
const postponeFirstAndReachLastStep = async (page: Page) => {
  await page.getByRole('button', { name: 'Пропустить шаг', exact: true }).click()
  await expect(
    page.getByText('Точка отложена — вернитесь к ней, иначе квест не засчитается'),
  ).toBeVisible({ timeout: 30_000 })

  await answerCurrentStep(page, 'ответ на вторую точку', 1)
  await answerCurrentStep(page, 'ответ на третью точку', 2)
}

test.describe('Долг маршрута после отложенной точки (#1633)', () => {
  test('на последней точке видно, какой точки не хватает, и есть выход на финал', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    const debt = page.getByTestId('quest-step-pending-notice')
    await expect(debt).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Осталась 1 точка')).toBeVisible()
    // Долг назван поимённо, а не числом: игрок должен знать, куда возвращаться.
    await expect(page.getByTestId(`quest-step-pending-go-${POSTPONED_STEP_ID}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Вернуться: Точка 1' })).toBeVisible()
    await expect(page.getByTestId('quest-step-pending-finish')).toBeVisible()
  })

  test('отложенная точка помечена в навигации по маршруту отдельным состоянием', async ({ page }) => {
    await openQuest(page)

    // До пропуска состояния нет: точка просто ещё впереди.
    await expect(page.getByRole('button', { name: 'Точка 1 — отложена, ждёт ответа' })).toHaveCount(0)

    await postponeFirstAndReachLastStep(page)

    // Долг назван словами, а не только цветом: состояние читается и скринридером.
    await expect(page.getByRole('button', { name: 'Точка 1 — отложена, ждёт ответа' })).toBeVisible({
      timeout: 30_000,
    })
    // Пройденная точка тем же состоянием не метится.
    await expect(page.getByRole('button', { name: 'Точка 2 — отложена, ждёт ответа' })).toHaveCount(0)
  })

  test('возврат к отложенной точке закрывает гейт: прохождение засчитывается полностью', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    await page.getByTestId(`quest-step-pending-go-${POSTPONED_STEP_ID}`).click()
    await answerCurrentStep(page, 'ответ на отложенную точку', 3)

    // Точки 2 и 3 уже отвечены — проходим их «Далее» до последней.
    await page.getByTestId('quest-step-continue').click()
    await page.getByTestId('quest-step-continue').click()

    // Долга больше нет, и последняя точка ведёт себя как обычная.
    await expect(page.getByTestId('quest-step-pending-notice')).toHaveCount(0)
    await answerCurrentStep(page, 'ответ на последнюю точку', STEP_TOTAL)

    await expect(page.getByTestId('quest-finale-not-credited')).toHaveCount(0)
    await expect(page.getByText('Квест завершён.')).toBeVisible({ timeout: 30_000 })
  })

  test('«Завершить квест здесь» из блока долга даёт финал с частичным результатом', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    await page.getByTestId('quest-step-pending-finish').click()

    // Финал есть — но честно помечен как незасчитанный: политика #1443 не тронута.
    await expect(page.getByText('Квест завершён.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('quest-finale-not-credited')).toBeVisible()
  })
})
