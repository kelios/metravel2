import type { Page, Route } from '@playwright/test'

import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

const QUEST_ID = 'e2e-video-quest'
const YOUTUBE_ID = 'dQw4w9WgXcQ'

const questBundle = {
  id: 91_004,
  quest_id: QUEST_ID,
  title: 'E2E-квест с видео',
  cover_url: null,
  steps: [
    {
      id: 1,
      step_id: 'video-step',
      title: 'Финальная точка',
      location: 'Минск',
      story: 'Детерминированный шаг для проверки видео в финале.',
      task: 'Введите любое слово.',
      hint: 'Подойдёт любой непустой ответ.',
      answer_pattern: { type: 'any_text', value: { min_length: 1 } },
      lat: 53.9023,
      lng: 27.5619,
      maps_url: 'https://www.openstreetmap.org/?mlat=53.9023&mlon=27.5619',
      image_url: null,
      order: 1,
      is_intro: false,
      country_code: 'BY',
    },
  ],
  finale: {
    text: 'Квест завершён.',
    video_url: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
    poster_url: null,
  },
  intro: null,
  storage_key: QUEST_ID,
  city: {
    id: 1,
    name: 'Минск',
    lat: 53.9023,
    lng: 27.5619,
    country_code: 'BY',
  },
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

    if (pathname.includes(`/quests/by-quest-id/${QUEST_ID}/`)) {
      return fulfillJson(route, questBundle)
    }
    if (pathname.includes(`/quests/quest${QUEST_ID}/reviews/`)) {
      return fulfillJson(route, [])
    }

    return fulfillJson(route, {})
  })

  // The test validates our embed contract, not YouTube availability.
  await page.route('https://www.youtube.com/embed/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Video fixture</title>' }),
  )
}

test.describe('Quest finale video', () => {
  test('a completed quest renders its normalized YouTube finale embed without media errors', async ({ page }) => {
    const pageErrors: string[] = []
    const mediaErrors: string[] = []

    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      const text = message.text()
      if (text.includes('[WebVideo] Video error') || text.includes('Failed to load media')) {
        mediaErrors.push(text)
      }
    })

    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockQuestApis(page)

    await page.goto(`/quests/minsk/${QUEST_ID}`, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Начать квест', exact: true }).click()

    const answer = page.getByPlaceholder('Ваш ответ')
    await expect(answer).toBeVisible({ timeout: 30_000 })
    await answer.fill('готово')
    await page.getByRole('button', { name: 'Проверить ответ' }).click()

    const finaleVideo = page.locator(`iframe[src*="youtube.com/embed/${YOUTUBE_ID}"]`)
    await expect(finaleVideo).toBeVisible({ timeout: 15_000 })
    await expect(finaleVideo).toHaveAttribute(
      'src',
      `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
    )
    await expect(page.getByText('Квест завершён.', { exact: true })).toBeVisible()

    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toHaveLength(0)
    expect(mediaErrors, `media errors: ${mediaErrors.join('\n')}`).toHaveLength(0)
  })
})
