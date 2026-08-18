import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1456: одно устройство — два аккаунта. Локальная копия прогресса квеста лежала
 * под ключом самого квеста, поэтому после логаута A и логина B визард сливал
 * серверный прогресс B с записью A: чужие ответы подставлялись, а монотонный
 * `completed` уезжал в серверную запись B. Ключ теперь содержит id пользователя.
 */

const QUEST_ID = 'e2e-shared-device-quest'
const USER_A_ID = '1'
const USER_B_ID = '2'
const LEGACY_KEY = QUEST_ID
const USER_A_KEY = `${QUEST_ID}__u${USER_A_ID}`
const USER_B_KEY = `${QUEST_ID}__u${USER_B_ID}`
const A_ANSWER_1 = 'ответ первого аккаунта'
const A_ANSWER_2 = 'второй ответ первого аккаунта'
const B_ANSWER_1 = 'ответ второго аккаунта'

const questCity = { id: 1, name: 'Минск', lat: 53.9023, lng: 27.5619, country_code: 'BY' }

const buildStep = (order: number) => ({
  id: order,
  step_id: `shared-step-${order}`,
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
  id: 91_010,
  quest_id: QUEST_ID,
  title: 'E2E-квест общего устройства',
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

/** Локальная запись, оставшаяся от аккаунта A: оба ответа и засчитанное прохождение. */
const leftoverRecordOfUserA = {
  index: 2,
  unlocked: 2,
  answers: { 'shared-step-1': A_ANSWER_1, 'shared-step-2': A_ANSWER_2 },
  attempts: {},
  hints: {},
  showMap: true,
  completed: true,
  skipped: {},
  earlyFinish: false,
  updatedAt: 1_760_000_000_000,
  answeredAt: { 'shared-step-1': 1_760_000_000_000, 'shared-step-2': 1_760_000_000_000 },
}

const serverProgressOf = (userId: string) => ({
  id: userId === USER_A_ID ? 501 : 502,
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
})

const fulfillJson = (route: Route, value: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })

type ProgressPatch = { id: string; body: any }

const mockApis = async (page: Page, userId: string, patches: ProgressPatch[]) => {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname

    if (pathname.includes('/user/me/verifications/')) return fulfillJson(route, { ok: true })
    if (/\/user\/\d+\/profile\//.test(pathname)) {
      return fulfillJson(route, { id: Number(userId), name: 'E2E', email: 'e2e@example.com', is_premium: false })
    }
    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) return fulfillJson(route, questBundle)
    if (pathname.includes(`/quest-progress/quest/${QUEST_ID}/`)) return fulfillJson(route, serverProgressOf(userId))

    const patchMatch = pathname.match(/\/quest-progress\/(\d+)\/$/)
    if (patchMatch) {
      let body: any = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      if (body) patches.push({ id: patchMatch[1], body })
      return fulfillJson(route, { ...serverProgressOf(userId), ...body })
    }

    if (pathname.includes('/reviews/')) return fulfillJson(route, [])
    return fulfillJson(route, {})
  })
}

const seedDevice = async (page: Page, userId: string) => {
  await page.addInitScript(
    ({ user, legacyKey, userAKey, leftover }) => {
      try {
        window.localStorage.setItem('userId', user)
        window.localStorage.setItem('userName', 'E2E')
        window.localStorage.setItem('isSuperuser', 'false')
        window.localStorage.setItem(
          'metravel_action_consents_v1',
          JSON.stringify({ quest_start: { version: '1', date: new Date().toISOString() } }),
        )
        // Записи, оставшиеся на устройстве от аккаунта A: старый (до #1456)
        // общий ключ и ключ самого аккаунта A.
        window.localStorage.setItem(legacyKey, JSON.stringify(leftover))
        window.localStorage.setItem(userAKey, JSON.stringify(leftover))
      } catch {
        // ignore
      }
    },
    { user: userId, legacyKey: LEGACY_KEY, userAKey: USER_A_KEY, leftover: leftoverRecordOfUserA },
  )
}

test.describe('Quest progress is scoped to the signed-in account (#1456)', () => {
  test('вошедший следом аккаунт не получает ни ответов, ни «Пройден» предыдущего', async ({ page }) => {
    const patches: ProgressPatch[] = []

    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockApis(page, USER_B_ID, patches)
    await seedDevice(page, USER_B_ID)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })

    // Аккаунт B начинает с нуля: стартовый экран квеста, а не шаг 2 из чужой
    // записи (`index: 2`), и без чужого финала.
    const startButton = page.getByRole('button', { name: 'Начать квест' })
    await expect(startButton).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(A_ANSWER_1, { exact: false })).toHaveCount(0)
    await expect(page.getByText('Квест завершён.', { exact: true })).toHaveCount(0)

    await startButton.click()

    const answer = page.getByRole('textbox').first()
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await expect(answer).toHaveValue('')

    await answer.fill(B_ANSWER_1)
    await page.getByRole('button', { name: 'Проверить ответ' }).click()

    await expect
      .poll(() => patches.length, { timeout: 20_000 })
      .toBeGreaterThan(0)

    // Всё, что улетело на сервер, — прогресс самого B: его запись (id 502),
    // его ответ, без чужого второго ответа и без чужого `completed`.
    for (const patch of patches) {
      expect(patch.id).toBe('502')
      expect(patch.body.completed).not.toBe(true)
      expect(JSON.stringify(patch.body.answers ?? {})).not.toContain(A_ANSWER_2)
    }

    const storage = await page.evaluate(
      ({ legacyKey, userAKey, userBKey }) => ({
        legacy: window.localStorage.getItem(legacyKey),
        userA: window.localStorage.getItem(userAKey),
        userB: window.localStorage.getItem(userBKey),
      }),
      { legacyKey: LEGACY_KEY, userAKey: USER_A_KEY, userBKey: USER_B_KEY },
    )

    // B пишет под своим ключом; чужие записи не тронуты и не прочитаны.
    expect(storage.userB, 'запись аккаунта B должна появиться').toBeTruthy()
    const userBRecord = JSON.parse(storage.userB as string)
    expect(userBRecord.answers['shared-step-1']).toBe(B_ANSWER_1)
    expect(userBRecord.answers['shared-step-2']).toBeUndefined()
    expect(userBRecord.completed).not.toBe(true)

    expect(JSON.parse(storage.legacy as string)).toMatchObject({ completed: true })
    expect(JSON.parse(storage.userA as string)).toMatchObject({ completed: true })
  })
})
