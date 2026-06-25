import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const WAIT_MS = 30_000

// A single quest with reviews so the compact reviews chip is guaranteed to render.
const MOCK_QUEST = {
  id: 9901,
  quest_id: 'e2e-reviews-quest',
  title: 'E2E квест с отзывами',
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
  rating_avg: 4.5,
  rating_count: 3,
  user_rating: null,
  completions_count: 4,
  is_completed_by_me: false,
  first_completer: null,
}

const MOCK_REVIEWS = [
  {
    id: 1,
    rating: 5,
    liked: 'Замечательный маршрут по центру, прошли за два часа на одном дыхании.',
    disliked: '',
    author_name: 'Тестовая Анна',
    author_avatar: null,
    created_at: '2025-09-01T10:00:00Z',
  },
  {
    id: 2,
    rating: 4,
    liked: 'Интересные загадки, узнали много нового о городе.',
    disliked: 'Одна точка была сложновата для поиска.',
    author_name: 'Тестовый Дмитрий',
    author_avatar: null,
    created_at: '2025-08-15T12:00:00Z',
  },
]

const mockQuestApis = async (page: Page) => {
  // Playwright runs the most-recently-registered matching route first, so the
  // broad catalog route is registered before the specific reviews route.
  await page.route('**/api/quests**', (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname.replace(/\/+$/, '')
    if (pathname === '/api/quests') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_QUEST]),
      })
    }
    return route.continue()
  })

  await page.route('**/quests/quest*/reviews/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEWS),
    }),
  )
}

test.describe('Quest reviews reader', () => {
  test('guest opens the compact reviews chip and sees mocked reviews', async ({ page }) => {
    await preacceptCookies(page)
    await mockQuestApis(page)
    await page.setViewportSize({ width: 390, height: 844 })

    await gotoWithRetry(page, '/quests')

    const chip = page.getByTestId(`quest-card-reviews-${MOCK_QUEST.quest_id}`)
    await expect(chip).toBeVisible({ timeout: WAIT_MS })
    await page.screenshot({ path: 'test-results/quest-reviews-chip.png' })

    await chip.click()

    const modal = page.getByTestId('quest-reviews-modal')
    await expect(modal).toBeVisible({ timeout: WAIT_MS })
    await expect(page.getByText('Тестовая Анна')).toBeVisible({ timeout: WAIT_MS })
    await page.screenshot({ path: 'test-results/quest-reviews-modal.png' })

    await expect(
      page.getByText(/Замечательный маршрут по центру/i),
    ).toBeVisible({ timeout: WAIT_MS })
    await expect(page.getByText('Тестовый Дмитрий')).toBeVisible({ timeout: WAIT_MS })

    // Close the reader.
    await page.getByTestId('quest-reviews-close').click()
    await expect(modal).toBeHidden({ timeout: WAIT_MS })
  })
})
