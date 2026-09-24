import { test as base, expect, type APIRequestContext } from '@playwright/test'
import { apiContextFromEnv, apiRequestContext } from './helpers/e2eApi'
import {
  MOBILE_SCREEN_BUDGET,
  MOBILE_VIEWPORTS,
  TRIP_PLAN_SCREEN_KEY,
  measureScreenAllCombos,
  printResultsTable,
} from './helpers/mobileScreenBudget'

/**
 * #2094: тот же замер мобильного бюджета, но для `/trips/plan/:id` — экран
 * требует реальную поездку (маршрут строится по данным на бэкенде, мок здесь
 * не годится тем же контрактом, что и остальной live-contract набор). Спека
 * создаёт одну тестовую поездку через существующий API поездок и удаляет её
 * в конце прогона; только `E2E_SUITE=live-contract E2E_ALLOW_LIVE_MUTATIONS=1`
 * против локального стека — классификация в
 * `scripts/e2e-suite-classification.js` не даёт ей попасть в дефолтный
 * детерминированный прогон.
 *
 * Без `mode: 'serial'` — та же причина, что в остальных двух файлах замера.
 */

function requireLocalLiveContractTarget(baseURL: string | undefined) {
  if (process.env.E2E_SUITE !== 'live-contract' || process.env.E2E_ALLOW_LIVE_MUTATIONS !== '1') {
    throw new Error(
      'mobile-screen-budget-trip-plan requires E2E_SUITE=live-contract E2E_ALLOW_LIVE_MUTATIONS=1'
    )
  }
  for (const [name, value] of Object.entries({ baseURL, E2E_API_URL: process.env.E2E_API_URL })) {
    if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
      throw new Error(`${name} must explicitly target the local stack for mobile-screen-budget-trip-plan`)
    }
  }
}

type Planner = { id: number; title: string; api: APIRequestContext }

// Worker-scoped: одна поездка на воркер. Файл держит один тест
// (`measureScreenAllCombos` снимает все 4 комбинации на одной навигации), но
// worker-scope остаётся на случай будущего шардирования — trip создаётся
// один раз, а не при каждом обращении к фикстуре.
const test = base.extend<object, { planner: Planner }>({
  planner: [
    // Playwright требует деструктуризацию первым аргументом; воркер-фикстуре здесь ничего не нужно.
    // eslint-disable-next-line no-empty-pattern
    async ({}, runFixture) => {
      // `baseURL` — тест-скоуп фикстура Playwright, а `planner` живёт на
      // уровне воркера (одна поездка на воркер): читаем тот же `BASE_URL`,
      // из которого `playwright.config.ts` сам собирает `baseURL`.
      requireLocalLiveContractTarget(process.env.BASE_URL)
      const auth = await apiContextFromEnv()
      if (!auth) throw new Error('mobile-screen-budget-trip-plan requires a real authenticated storageState')
      const api = await apiRequestContext(auth)
      let id: number | undefined
      const title = `E2E mobile-screen-budget ${Date.now()}`
      try {
        const created = await api.post('/api/trips/planned/', {
          data: {
            title,
            description: 'Temporary local #2094 fixture — mobile screen budget measurement',
            start_date: '2026-10-01',
            status: 'planned',
            is_public: false,
            max_participants: 4,
            transport_mode: 'walk',
            create_telegram_group: false,
          },
        })
        expect(created.status(), 'Create local mobile-screen-budget fixture trip').toBe(201)
        id = Number((await created.json()).id)
        expect(Number.isSafeInteger(id) && id > 0).toBe(true)

        // Точка нужна, чтобы вкладка «Маршрут» не встречала совсем пустое
        // состояние без карты — тот же минимальный сид, что в #1843.
        const seeded = await api.put(`/api/trips/planned/${id}/route/`, {
          data: {
            points: [
              { order: 1, point_type: 'custom', title: 'E2E старт', description: '', lat: 53.9, lng: 27.56 },
              { order: 2, point_type: 'custom', title: 'E2E финиш', description: '', lat: 53.8, lng: 27.4 },
            ],
          },
        })
        expect(seeded.ok(), 'Seed two custom points').toBe(true)

        await runFixture({ id: id!, title, api })
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
    { scope: 'worker' },
  ],
})

test.describe('Mobile screen budget — trip plan (#2094, live-contract)', () => {
  test('trips-plan-id', async ({ page, planner }) => {
    await measureScreenAllCombos(page, {
      screenKey: TRIP_PLAN_SCREEN_KEY,
      path: `/trips/plan/${planner.id}`,
      title: planner.title,
      viewports: MOBILE_VIEWPORTS,
      ctaTestId: 'trip-plan-edit',
      budget: MOBILE_SCREEN_BUDGET[TRIP_PLAN_SCREEN_KEY],
    })
  })

  test.afterAll(() => {
    printResultsTable([TRIP_PLAN_SCREEN_KEY])
  })
})
