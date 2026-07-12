import { test, expect } from '@playwright/test'

/**
 * Trip planning — planner happy-path (Sprint 13, FE-trip-tests #406).
 *
 * Auth setup mirrors public-trips.spec.ts: storageState.json for account A.
 *
 * The create flow mocks only POST /trips/planned/ locally so this spec does not
 * depend on a deployed planner backend and does not enable the global trip mock
 * flag that would affect public-trips real-BE coverage.
 */

import fs from 'node:fs'

const STORAGE_STATE_A = 'e2e/.auth/storageState.json'
const hasAState = () => fs.existsSync(STORAGE_STATE_A)

function requireAuthState() {
  if (!hasAState()) {
    throw new Error(`${STORAGE_STATE_A} is required; run the Playwright global setup first`)
  }
}

function readUserIdFromState(filePath: string): number {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any
    const origins: any[] = Array.isArray(json?.origins) ? json.origins : []
    for (const origin of origins) {
      const ls: any[] = Array.isArray(origin?.localStorage) ? origin.localStorage : []
      const entry = ls.find((x: any) => x?.name === 'userId')
      const id = Number(entry?.value)
      if (Number.isFinite(id) && id > 0) return id
    }
  } catch {
    // fall through to the stable fallback below
  }
  return 1
}

async function mockCreateTrip(page: import('@playwright/test').Page) {
  const ownerId = readUserIdFromState(STORAGE_STATE_A)

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
    requireAuthState()

    await seedConsent(page)
    await page.goto('/trips/plan', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/trips\/my(?:\?.*)?$/, { timeout: 15_000 })
    await expect(page.getByTestId('my-trips-plan-cta')).toBeVisible()
    await expect(page.getByTestId('my-trips-segments')).toBeVisible()
  })

  test('creates a trip via the form and navigates to the plan page', async ({ browser }) => {
    requireAuthState()

    const ctx = await browser.newContext({
      storageState: STORAGE_STATE_A,
    })
    const page = await ctx.newPage()

    try {
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

      // After submit the app should navigate away from the create form.
      // Either to a detail plan page or back to the trips list.
      await expect(page).toHaveURL(/\/trips\/plan\/99001$/, { timeout: 15_000 })
    } finally {
      await ctx.close()
    }
  })
})
