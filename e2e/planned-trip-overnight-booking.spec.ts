import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
import { apiContextFromEnv, apiRequestContext } from './helpers/e2eApi'
import { seedNecessaryConsent } from './helpers/storage'

/**
 * #1843: поля брони ночёвки сохраняются через живой бэкенд и переживают reload.
 * Только live-contract: создаёт и удаляет поездку на локальном стеке.
 */

type Planner = { id: number; api: APIRequestContext }

function requireLocalTarget(baseURL: string | undefined) {
  if (process.env.E2E_SUITE !== 'live-contract' || process.env.E2E_ALLOW_LIVE_MUTATIONS !== '1') {
    throw new Error('Overnight booking live-contract requires E2E_SUITE=live-contract E2E_ALLOW_LIVE_MUTATIONS=1')
  }
  for (const [name, value] of Object.entries({ baseURL, E2E_API_URL: process.env.E2E_API_URL })) {
    if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
      throw new Error(`${name} must explicitly target the local stack for overnight booking`)
    }
  }
}

const test = base.extend<{ planner: Planner }>({
  planner: async ({ baseURL }, runFixture) => {
    requireLocalTarget(baseURL)
    const auth = await apiContextFromEnv()
    if (!auth) throw new Error('Overnight booking requires a real authenticated storageState')
    const api = await apiRequestContext(auth)
    let id: number | undefined
    try {
      const created = await api.post('/api/trips/planned/', {
        data: {
          title: `E2E overnight ${Date.now()}`,
          description: 'Temporary local #1843 fixture',
          start_date: '2026-09-26',
          status: 'planned',
          is_public: false,
          max_participants: 4,
          transport_mode: 'walk',
          create_telegram_group: false,
        },
      })
      expect(created.status(), 'Create local overnight fixture').toBe(201)
      id = Number((await created.json()).id)
      expect(Number.isSafeInteger(id) && id > 0).toBe(true)
      const seeded = await api.put(`/api/trips/planned/${id}/route/`, {
        data: {
          points: [
            {
              order: 1,
              point_type: 'custom',
              title: 'E2E старт',
              description: '',
              lat: 49.81,
              lng: 6.42,
            },
            {
              order: 2,
              point_type: 'custom',
              title: 'E2E финиш',
              description: '',
              lat: 49.82,
              lng: 6.43,
            },
          ],
        },
      })
      expect(seeded.ok(), 'Seed two custom points').toBe(true)
      await runFixture({ id: id!, api })
    } finally {
      try {
        if (id) {
          const deleted = await api.delete(`/api/trips/${id}/`)
          expect(deleted.ok() || deleted.status() === 404, 'Remove only this test’s trip').toBe(true)
        }
      } finally {
        await api.dispose()
      }
    }
  },
})

async function seedUi(page: Page) {
  await page.addInitScript(seedNecessaryConsent)
  await page.addInitScript(() =>
    localStorage.setItem(
      '@metravel/locale-preference:v1',
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }),
    ),
  )
}

async function openPlanner(page: Page, planner: Planner) {
  await seedUi(page)
  const loaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/trips/planned/${planner.id}/` &&
      response.request().method() === 'GET',
  )
  await page.goto(`/trips/plan/${planner.id}`, { waitUntil: 'domcontentloaded' })
  expect((await loaded).ok(), 'Planner must load the real API trip').toBe(true)
  await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 30_000 })
}

test.describe('#1843 overnight booking live-contract', () => {
  test('desktop: fill overnight fields, persist, reload, keep custom points clean', async ({
    page,
    planner,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openPlanner(page, planner)

    await page.getByTestId('route-builder-edit-0').scrollIntoViewIfNeeded()
    await page.getByTestId('route-builder-edit-0').click()
    await expect(page.getByTestId('route-builder-overnight-fields')).toHaveCount(0)
    await page.getByTestId('route-builder-edit-type-overnight').click()
    await expect(page.getByTestId('route-builder-overnight-fields')).toBeVisible()

    await page.getByTestId('route-builder-overnight-address').fill('Rue de la Gare 1, Echternach')
    await page.getByTestId('route-builder-overnight-url').fill('booking.com/hotel/lu/echternach.html')
    await page.getByTestId('route-builder-overnight-price').fill('84,50')
    await page.getByTestId('route-builder-overnight-checkin').fill('15.00')
    await page.getByTestId('route-builder-edit-save').click()

    await expect(page.getByTestId('route-builder-save')).toBeVisible()
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === `/api/trips/planned/${planner.id}/route/`,
    )
    await page.getByTestId('route-builder-save').click()
    const response = await saved
    expect(response.ok(), 'Persist overnight booking through the real API').toBe(true)
    const payload = response.request().postDataJSON() as {
      points: Array<Record<string, unknown>>
    }
    expect(payload.points[0]).toEqual(
      expect.objectContaining({
        point_type: 'overnight',
        address: 'Rue de la Gare 1, Echternach',
        booking_url: 'https://booking.com/hotel/lu/echternach.html',
        price: 84.5,
        checkin_time: '15:00',
      }),
    )
    expect(payload.points[1]).not.toEqual(expect.objectContaining({ address: expect.anything() }))
    expect(Object.keys(payload.points[1])).toEqual(
      expect.not.arrayContaining(['address', 'booking_url', 'price', 'checkin_time']),
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('route-builder-point-booking-0')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('route-builder-point-booking-link-0')).toHaveAttribute(
      'href',
      'https://booking.com/hotel/lu/echternach.html',
    )
    await expect(page.getByTestId('route-builder-point-booking-1')).toHaveCount(0)

    await page.getByTestId('route-builder-edit-1').click()
    await expect(page.getByTestId('route-builder-overnight-fields')).toHaveCount(0)

    await page.screenshot({
      path: 'test-results/1843-overnight-desktop-1280.png',
      fullPage: true,
    })
  })

  test('mobile web: overnight fields and booking row fit the 390 card', async ({
    page,
    planner,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPlanner(page, planner)

    await page.getByTestId('route-builder-edit-0').scrollIntoViewIfNeeded()
    await page.getByTestId('route-builder-edit-0').click()
    await page.getByTestId('route-builder-edit-type-overnight').click()
    const fields = page.getByTestId('route-builder-overnight-fields')
    await expect(fields).toBeVisible()
    const box = await fields.boundingBox()
    expect(box, 'overnight fields must be laid out').toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(390)

    await page.getByTestId('route-builder-overnight-url').fill('booking.com/hotel/lu/echternach.html')
    await page.getByTestId('route-builder-edit-save').click()
    await expect(page.getByTestId('route-builder-save')).toBeVisible()
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === `/api/trips/planned/${planner.id}/route/`,
    )
    await page.getByTestId('route-builder-save').click()
    expect((await saved).ok()).toBe(true)

    await expect(page.getByTestId('route-builder-point-booking-0')).toBeVisible()
    const booking = await page.getByTestId('route-builder-point-booking-0').boundingBox()
    expect(booking!.width).toBeLessThanOrEqual(390)
    await page.screenshot({
      path: 'test-results/1843-overnight-mobile-390.png',
      fullPage: true,
    })
  })
})
