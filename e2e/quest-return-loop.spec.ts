import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1484: петля возврата после финиша квеста. До неё взаимодействие с продуктом
 * обрывалось на финальном видео — второго действия не было вовсе.
 *
 * Спека доказывает на реальном экране финала три вещи, которые невозможно
 * проверить юнит-тестом компонента: блок «Следующий квест рядом» доживает до
 * DOM внутри визарда, полоса коллекции считает реальные числа каталога, и оба
 * события аналитики уходят в `gtag` с ожидаемыми параметрами.
 *
 * Прохождение здесь целиком на моках: настоящий прогон на проде занял бы бейдж
 * первопроходца безвозвратно (#1434).
 */

const QUEST_ID = 'e2e-return-loop-quest'
const USER_ID = '7'
const CITY = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

const NEAR_QUEST_ID = 'e2e-return-loop-near'
const MID_QUEST_ID = 'e2e-return-loop-mid'
const DONE_QUEST_ID = 'e2e-return-loop-done'
const FAR_QUEST_ID = 'e2e-return-loop-far'

const buildStep = (order: number) => ({
  id: order,
  step_id: `return-loop-step-${order}`,
  title: `Точка ${order}`,
  location: CITY.name,
  story: 'Детерминированный шаг для проверки петли возврата.',
  task: 'Введите любое слово.',
  hint: 'Подойдёт любой непустой ответ.',
  answer_pattern: { type: 'any_text', value: { min_length: 1 } },
  lat: CITY.lat,
  lng: CITY.lng,
  maps_url: 'https://www.openstreetmap.org/?mlat=53.9023&mlon=27.5619',
  image_url: null,
  order,
  is_intro: false,
  country_code: CITY.country_code,
})

const questBundle = {
  id: 91_484,
  quest_id: QUEST_ID,
  title: 'E2E-квест петли возврата',
  cover_url: null,
  steps: [buildStep(1), buildStep(2)],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  intro: null,
  storage_key: QUEST_ID,
  city: CITY,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

const catalogEntry = (over: {
  quest_id: string
  title: string
  lat: number
  lng: number
  duration_min: number | null
  city_id?: string
  city_name?: string
  is_completed_by_me?: boolean
}) => ({
  id: Math.abs(over.quest_id.length * 1000 + over.lat),
  quest_id: over.quest_id,
  title: over.title,
  points: 5,
  city_id: over.city_id ?? String(CITY.id),
  city_name: over.city_name ?? CITY.name,
  country_id: 'BY',
  country_name: 'Беларусь',
  country_code: 'BY',
  lat: over.lat,
  lng: over.lng,
  duration_min: over.duration_min,
  difficulty: 'easy' as const,
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  completions_count: 0,
  is_completed_by_me: over.is_completed_by_me ?? false,
  first_completer: null,
})

/**
 * Каталог города: четыре квеста Минска (один уже пройден, один проходится
 * прямо сейчас) плюс квест Гродно за пределами радиуса — он обязан отсеяться.
 */
const compactCatalog = [
  catalogEntry({ quest_id: QUEST_ID, title: questBundle.title, lat: CITY.lat, lng: CITY.lng, duration_min: 60 }),
  catalogEntry({
    quest_id: NEAR_QUEST_ID,
    title: 'Соседний квест рядом',
    lat: 53.9123,
    lng: CITY.lng,
    duration_min: 45,
  }),
  catalogEntry({
    quest_id: MID_QUEST_ID,
    title: 'Второй квест того же города',
    lat: 53.9323,
    lng: CITY.lng,
    duration_min: 90,
  }),
  catalogEntry({
    quest_id: DONE_QUEST_ID,
    title: 'Уже пройденный квест',
    lat: 53.9023,
    lng: 27.5719,
    duration_min: 60,
    is_completed_by_me: true,
  }),
  catalogEntry({
    quest_id: FAR_QUEST_ID,
    title: 'Квест другого города за радиусом',
    lat: 53.6884,
    lng: 23.8258,
    duration_min: 60,
    city_id: '2',
    city_name: 'Гродно',
  }),
]

const serverProgress = {
  id: 484,
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
    const url = new URL(route.request().url())
    const pathname = url.pathname

    if (pathname.includes('/user/me/verifications/')) return fulfillJson(route, { ok: true })
    if (/\/user\/\d+\/profile\//.test(pathname)) {
      return fulfillJson(route, {
        id: Number(USER_ID),
        name: 'E2E',
        email: 'e2e@example.com',
        is_premium: false,
      })
    }
    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) return fulfillJson(route, questBundle)
    if (pathname.includes(`/quest-progress/quest/${QUEST_ID}/`)) return fulfillJson(route, serverProgress)
    if (/\/quest-progress\/\d+\/$/.test(pathname)) return fulfillJson(route, serverProgress)
    if (pathname.includes('/quest-progress/')) return fulfillJson(route, [])
    // Компактный каталог и полный список квестов ходят по одному пути.
    // Отдаём страницами: на проде это `fetchAllPages`, и одностраничный массив
    // не доказал бы, что блок собирает каталог целиком.
    if (/\/quests\/?$/.test(pathname)) {
      const page = Number(url.searchParams.get('page') || '1')
      const head = compactCatalog.slice(0, 2)
      const tail = compactCatalog.slice(2)
      return page > 1
        ? fulfillJson(route, { results: tail, next: null })
        : fulfillJson(route, { results: head, next: '/api/quests/?page=2' })
    }
    if (pathname.includes('/reviews/')) return fulfillJson(route, [])
    return fulfillJson(route, {})
  })
}

/**
 * Согласие на аналитику плюс несменяемый `window.gtag`: `sendAnalyticsEvent`
 * молчит без согласия, а загрузившийся GA перетёр бы наш перехватчик.
 */
const seedDevice = async (page: Page, opts?: { finishRecord?: unknown; finishKey?: string }) => {
  await page.addInitScript(
    ({ user, finishRecord, finishKey }) => {
      try {
        const now = new Date().toISOString()
        window.localStorage.setItem('userId', user)
        window.localStorage.setItem('userName', 'E2E')
        window.localStorage.setItem('isSuperuser', 'false')
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: true, date: now }),
        )
        window.localStorage.setItem(
          'metravel_action_consents_v1',
          JSON.stringify({ quest_start: { version: '1', date: now } }),
        )
        if (finishRecord && finishKey) {
          window.localStorage.setItem(finishKey, JSON.stringify(finishRecord))
        }
      } catch {
        // ignore
      }

      const events: { name: string; params: Record<string, unknown> }[] = []
      const recorder = (...args: any[]) => {
        if (args[0] === 'event') events.push({ name: String(args[1]), params: args[2] ?? {} })
      }
      Object.defineProperty(window, '__e2eAnalyticsEvents', { value: events, configurable: false })
      Object.defineProperty(window, 'gtag', {
        configurable: false,
        get: () => recorder,
        set: () => {},
      })
    },
    { user: USER_ID, finishRecord: opts?.finishRecord ?? null, finishKey: opts?.finishKey ?? null },
  )
}

type CapturedEvent = { name: string; params: Record<string, unknown> }

const readEvents = (page: Page, name: string): Promise<CapturedEvent[]> =>
  page.evaluate(
    (eventName) =>
      ((window as any).__e2eAnalyticsEvents ?? []).filter((e: CapturedEvent) => e.name === eventName),
    name,
  )

/** Прогон квеста до засчитанного финала: интро-шаг плюс обе точки. */
const finishQuest = async (page: Page) => {
  const startButton = page.getByRole('button', { name: 'Начать квест' })
  await expect(startButton).toBeVisible({ timeout: 60_000 })
  await startButton.click()

  for (let step = 1; step <= questBundle.steps.length; step++) {
    const answer = page.getByRole('textbox').first()
    await expect(answer, `шаг ${step}: поле ответа`).toBeVisible({ timeout: 30_000 })
    await answer.fill(`ответ ${step}`)
    await page.getByTestId('quest-step-check').click()

    // На засчитанном ответе визард сам переходит к следующей точке, и поле
    // ответа снова пустеет. Ждём именно это, а не исчезновение поля: застрявший
    // шаг иначе молча съедал бы таймаут всего теста вместо падения на нём.
    if (step < questBundle.steps.length) {
      await expect(
        page.getByRole('textbox').first(),
        `шаг ${step}: визард перешёл к следующей точке`,
      ).toHaveValue('', { timeout: 30_000 })
    }
  }

  // После последней точки визард открывает финал сам; пилюля степпера — запасной путь.
  const finaleText = page.getByText('Квест завершён.', { exact: true }).first()
  if (!(await finaleText.isVisible().catch(() => false))) {
    await page.getByText('Финал', { exact: true }).first().click()
  }
  await expect(finaleText, 'финал открыт').toBeVisible({ timeout: 30_000 })
}

test.describe('Петля возврата после финиша квеста (#1484)', () => {
  test('финал предлагает соседние квесты и считает коллекцию города', async ({ page }) => {
    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockApis(page)
    await seedDevice(page)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })
    await finishQuest(page)

    const section = page.getByTestId('quest-next-step-section')
    await expect(section).toBeVisible({ timeout: 60_000 })

    // Коллекция города: только что закрытый квест плюс ранее пройденный —
    // «Пройдено 2 из 4». Квест Гродно в знаменатель не попадает.
    await expect(page.getByText('Коллекция: Минск', { exact: true })).toBeVisible()
    await expect(page.getByText('Пройдено 2 из 4 квестов', { exact: true })).toBeVisible()

    // Два непройденных квеста того же города, ближний первым.
    await expect(section.getByText('Соседний квест рядом', { exact: true })).toBeVisible()
    await expect(section.getByText('Второй квест того же города', { exact: true })).toBeVisible()
    await expect(section.getByText('Уже пройденный квест', { exact: true })).toHaveCount(0)
    await expect(section.getByText('Квест другого города за радиусом', { exact: true })).toHaveCount(0)

    // Расстояние и время прохождения — оба обязательны по тикету.
    await expect(section.getByText('1,1 км', { exact: true })).toBeVisible()
    await expect(section.getByText('~45 мин', { exact: true })).toBeVisible()
    await expect(section.getByText('~1,5 ч', { exact: true })).toBeVisible()

    // Снимок финала — доказательство приёмки, каталог артефактов игнорируется git.
    await section.screenshot({ path: 'test-results/quest-1484-finale-next-step.png' })

    const collectionViews = await readEvents(page, 'city_collection_view')
    expect(collectionViews.length, 'city_collection_view уходит ровно один раз').toBe(1)
    expect(collectionViews[0].params).toMatchObject({
      city_id: '1',
      source: 'quest_finale',
      completed_count: 2,
      total_count: 4,
    })

    await section.getByText('Соседний квест рядом', { exact: true }).click()

    await expect.poll(async () => (await readEvents(page, 'next_quest_click')).length, {
      timeout: 15_000,
    }).toBe(1)
    const [click] = await readEvents(page, 'next_quest_click')
    expect(click.params).toMatchObject({
      quest_id: NEAR_QUEST_ID,
      from_quest_id: QUEST_ID,
      position: 1,
      other_city: false,
    })
    expect(Number(click.params.distance_km)).toBeGreaterThan(0)
  })

  test('возврат в каталог после финиша шлёт return_visit_after_finish', async ({ page }) => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockApis(page)
    await seedDevice(page, {
      finishKey: `questFinish:v2:${encodeURIComponent(`user:${USER_ID}`)}`,
      finishRecord: {
        ownerId: `user:${USER_ID}`,
        questId: QUEST_ID,
        cityId: String(CITY.id),
        cityName: CITY.name,
        finishedAt: twoDaysAgo,
      },
    })

    await page.goto('/quests', { waitUntil: 'domcontentloaded' })

    await expect.poll(async () => (await readEvents(page, 'return_visit_after_finish')).length, {
      timeout: 60_000,
    }).toBe(1)
    const [visit] = await readEvents(page, 'return_visit_after_finish')
    expect(visit.params).toMatchObject({
      quest_id: QUEST_ID,
      city_id: String(CITY.id),
      days_since_finish: 2,
    })
  })
})
