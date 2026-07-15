import { test, expect } from './fixtures'
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth'

/**
 * Trip planning — planner happy-path (Sprint 13, FE-trip-tests #406).
 *
 * The create flow mocks only POST /trips/planned/ locally so this spec does not
 * depend on a deployed planner backend and does not enable the global trip mock
 * flag that would affect public-trips real-BE coverage.
 */

async function setupFakeAuth(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
}

async function mockCreateTrip(page: import('@playwright/test').Page) {
  const ownerId = 1

  await page.route('**/api/trips/planned/', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.fallback()
      return
    }

    let body: Record<string, unknown> = {}
    try {
      const parsed = request.postDataJSON()
      if (parsed && typeof parsed === 'object') {
        body = parsed as Record<string, unknown>
      }
    } catch {
      body = {}
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 99001,
        title: String(body.title ?? 'E2E тест-поездка'),
        description: String(body.description ?? ''),
        start_date: String(body.start_date ?? '2026-09-01T09:00:00'),
        end_date: null,
        status: 'planned',
        owner: {
          id: ownerId,
          username: 'E2E User',
          avatar: null,
        },
        participants: [
          {
            user: {
              id: ownerId,
              username: 'E2E User',
              avatar: null,
            },
            status: 'accepted',
          },
        ],
        route: { points: [] },
        is_public: body.is_public === true,
        max_participants: Number(body.max_participants ?? 4),
      }),
    })
  })
}

// ── consent seed (mirrors public-trips.spec.ts pattern) ──────────────────────

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // ignore
    }
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Trip planner — happy path', () => {
  test('navigates to /trips/plan and renders the planner page', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await page.goto('/trips/plan', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/trips\/my(?:\?.*)?$/, { timeout: 15_000 })
    await expect(page.getByTestId('my-trips-plan-cta')).toBeVisible()
    await expect(page.getByTestId('my-trips-segments')).toBeVisible()
  })

  test('creates a trip via the form and navigates to the plan page', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await mockCreateTrip(page)
    await page.goto('/trips/plan/create', { waitUntil: 'domcontentloaded' })

    const form = page.getByTestId('trip-create-form')
    await expect(form).toBeVisible({ timeout: 15_000 })

    // Fill required fields.
    await page.getByTestId('trip-create-title').fill('E2E тест-поездка')
    await page.getByTestId('trip-create-start-date').fill('2026-09-01')
    await page.getByTestId('trip-create-seats').clear()
    await page.getByTestId('trip-create-seats').fill('4')

    // Toggle consent checkbox.
    await page.getByTestId('trip-create-consent').click()

    // Submit must now be enabled.
    const submitBtn = page.getByTestId('trip-create-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    await expect(page).toHaveURL(/\/trips\/plan\/99001$/, { timeout: 15_000 })
  })
})
