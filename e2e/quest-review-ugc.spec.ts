import fs from 'node:fs'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

/**
 * #1486: отзыв после финиша и порог показа агрегата в каталоге.
 * Фото/очередь точек не входят: live API отвергает collection=questReviewPhoto
 * (400 invalid choice) и локальный inaccuracy-reports даёт 404 HTML.
 */

const WAIT_MS = 60_000
const ARTIFACT_DIR = path.join('.codex-temp', 'quest-1486')
const NONE_ID = 'e2e-reviews-none'
const FEW_ID = 'e2e-reviews-few'
const MANY_ID = 'e2e-reviews-many'
const SUBMIT_ID = 'e2e-review-submit'
const USER_ID = '7'

const fulfillJson = (route: Route, value: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

const catalogQuest = (over: {
  quest_id: string
  title: string
  rating_avg: number | null
  rating_count: number
  id?: number
}) => ({
  id: over.id ?? Math.abs(over.quest_id.length * 97),
  quest_id: over.quest_id,
  title: over.title,
  points: '5',
  city_id: '1',
  city_name: 'Минск',
  country_id: '1',
  country_name: 'Беларусь',
  country_code: 'BY',
  lat: '53.9',
  lng: '27.5667',
  duration_min: 90,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: over.rating_avg,
  rating_count: over.rating_count,
  user_rating: null,
  completions_count: over.rating_count,
  is_completed_by_me: false,
  first_completer: null,
})

const CATALOG = [
  catalogQuest({ quest_id: NONE_ID, title: 'Квест без отзывов', rating_avg: null, rating_count: 0 }),
  catalogQuest({ quest_id: FEW_ID, title: 'Квест с двумя отзывами', rating_avg: 5, rating_count: 2 }),
  catalogQuest({
    quest_id: MANY_ID,
    title: 'Квест с тремя отзывами',
    rating_avg: 4.5,
    rating_count: 3,
  }),
]

const MOCK_REVIEWS = [
  {
    id: 11,
    rating: 5,
    liked: 'Замечательный маршрут по центру.',
    disliked: '',
    author_name: 'Тестовая Анна',
    author_avatar: null,
    created_at: '2025-09-01T10:00:00Z',
  },
  {
    id: 12,
    rating: 4,
    liked: 'Интересные загадки.',
    disliked: 'Одна точка была сложновата.',
    author_name: 'Тестовый Дмитрий',
    author_avatar: null,
    created_at: '2025-08-15T12:00:00Z',
  },
]

const buildStep = (order: number) => ({
  id: order,
  step_id: `review-submit-step-${order}`,
  title: `Точка ${order}`,
  location: 'Минск',
  story: 'Шаг для отправки отзыва.',
  task: 'Введите любое слово.',
  hint: 'Подойдёт любой непустой ответ.',
  answer_pattern: { type: 'any_text', value: { min_length: 1 } },
  lat: 53.9,
  lng: 27.5667,
  maps_url: 'https://www.openstreetmap.org/?mlat=53.9&mlon=27.5667',
  image_url: null,
  order,
  is_intro: false,
  country_code: 'BY',
})

const submitBundle = {
  id: 91486,
  quest_id: SUBMIT_ID,
  title: 'E2E отправка отзыва',
  cover_url: null,
  steps: [buildStep(1)],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  intro: null,
  storage_key: SUBMIT_ID,
  city: { id: 1, name: 'Минск', lat: 53.9, lng: 27.5667, country_code: 'BY' },
  rating_avg: null,
  rating_count: 0,
}

async function mockCatalogApis(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname.replace(/\/+$/, '')

    if (pathname.includes(`/quests/quest${MANY_ID}/reviews`)) {
      return fulfillJson(route, MOCK_REVIEWS)
    }
    if (pathname.includes('/reviews')) {
      return fulfillJson(route, { results: [], next: null })
    }
    if (pathname.endsWith('/quests') || pathname.endsWith('/api/quests')) {
      return fulfillJson(route, { results: CATALOG, next: null })
    }
    return route.fallback()
  })
}

test.describe('#1486 quest review UGC', () => {
  test('catalog hides the average until 3 reviews and still opens the reader', async ({ page }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    await preacceptCookies(page)
    await mockCatalogApis(page)

    for (const viewport of [
      { name: '1280', width: 1280, height: 900 },
      { name: '390', width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await gotoWithRetry(page, '/quests')

      await expect(page.getByTestId(`quest-card-reviews-${NONE_ID}`).first()).toBeVisible({
        timeout: WAIT_MS,
      })
      await expect(page.getByTestId(`quest-card-rating-${NONE_ID}`)).toHaveCount(0)
      await expect(page.getByTestId(`quest-card-rating-${FEW_ID}`)).toHaveCount(0)
      await expect(page.getByTestId(`quest-card-rating-${MANY_ID}`).first()).toBeVisible()

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `catalog-${viewport.name}.png`),
        fullPage: false,
      })
    }

    await page.getByTestId(`quest-card-reviews-${MANY_ID}`).first().click()
    const modal = page.getByTestId('quest-reviews-modal')
    await expect(modal).toBeVisible({ timeout: WAIT_MS })
    await expect(page.getByText('Тестовая Анна')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reader-many.png') })
    await page.getByTestId('quest-reviews-close').click()

    await page.getByTestId(`quest-card-reviews-${NONE_ID}`).first().click()
    await expect(page.getByTestId('quest-reviews-empty')).toBeVisible({ timeout: WAIT_MS })
    await expect(page.getByText('Пока нет отзывов')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reader-empty.png') })
  })

  test('finale submit shows an error that can be retried, then thanks only after 200', async ({
    page,
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    let reviewPosts = 0
    const postedBodies: unknown[] = []

    await preacceptCookies(page)
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
    await ensureAuthedStorageFallback(page, { userId: USER_ID, userName: 'E2E' })
    await mockFakeAuthApis(page)

    await page.route('**/api/quest-reviews/**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      reviewPosts += 1
      postedBodies.push(route.request().postDataJSON())
      if (reviewPosts === 1) {
        return fulfillJson(route, { detail: 'save failed' }, 500)
      }
      return fulfillJson(route, {
        id: 77,
        user: Number(USER_ID),
        quest: submitBundle.id,
        rating: 5,
        liked: 'Сюжет',
        disliked: '',
      })
    })
    await page.route(`**/quests/quest${submitBundle.id}/review/users/**`, (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
    )
    await page.route(`**/quests/by-quest-id/${SUBMIT_ID}/**`, (route) => fulfillJson(route, submitBundle))
    await page.route(`**/quest-progress/quest/${SUBMIT_ID}/**`, (route) =>
      fulfillJson(route, {
        id: 1486,
        quest: submitBundle.id,
        current_index: 0,
        unlocked_index: 0,
        answers: {},
        attempts: {},
        hints: {},
        show_map: true,
        completed: false,
      }),
    )
    await page.route('**/quest-progress/**', (route) => {
      if (route.request().url().includes(`/quest/${SUBMIT_ID}`) && route.request().method() === 'GET') {
        return route.fallback()
      }
      return fulfillJson(route, {
        id: 1486,
        quest: submitBundle.id,
        current_index: 1,
        unlocked_index: 1,
        answers: { 'review-submit-step-1': 'ответ 1' },
        attempts: {},
        hints: {},
        show_map: true,
        completed: true,
      })
    })
    await page.route('**/quests/quest*/reviews/**', (route) =>
      fulfillJson(route, { results: [], next: null }),
    )
    await page.route('**/api/quests/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname.replace(/\/+$/, '')
      if (!pathname.endsWith('/quests')) return route.fallback()
      return fulfillJson(route, {
        results: [
          catalogQuest({
            quest_id: SUBMIT_ID,
            title: submitBundle.title,
            rating_avg: null,
            rating_count: 0,
            id: submitBundle.id,
          }),
        ],
        next: null,
      })
    })

    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoWithRetry(page, `/quests/1/${SUBMIT_ID}`)
    const startButton = page.getByRole('button', { name: 'Начать квест' })
    await expect(startButton).toBeVisible({ timeout: WAIT_MS })
    await startButton.click()
    const answer = page.getByRole('textbox').first()
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await answer.fill('ответ 1')
    await page.getByTestId('quest-step-check').click()
    await expect(page.getByText('Квест завершён.', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })

    const section = page.getByTestId('quest-review-section')
    await expect(section).toBeVisible({ timeout: WAIT_MS })
    const fiveStar = section.getByRole('button', { name: 'Оценить на 5 из 5' }).last()
    await expect(fiveStar).toBeEnabled({ timeout: WAIT_MS })
    await fiveStar.click()
    await section.getByPlaceholder('Расскажите, что было интересно').fill('Сюжет')
    await expect(section.getByTestId('quest-review-section-submit')).toBeEnabled({ timeout: WAIT_MS })
    await section.getByTestId('quest-review-section-submit').click()

    await expect(section.getByTestId('quest-review-section-error')).toBeVisible({ timeout: WAIT_MS })
    await expect(section.getByText('Спасибо за отзыв!')).toHaveCount(0)
    await expect(section.getByPlaceholder('Расскажите, что было интересно')).toHaveValue('Сюжет')
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'submit-error.png') })

    await section.getByTestId('quest-review-section-submit').click()
    await expect(section.getByText('Спасибо за отзыв!')).toBeVisible({ timeout: WAIT_MS })
    await expect(section.getByTestId('quest-review-section-error')).toHaveCount(0)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'submit-success.png') })

    expect(reviewPosts).toBe(2)
    expect(postedBodies[0]).toMatchObject({ quest: submitBundle.id, rating: 5, liked: 'Сюжет' })
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'submit.json'),
      JSON.stringify({ reviewPosts, postedBodies }, null, 2),
    )
  })
})
