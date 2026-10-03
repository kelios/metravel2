import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  MOBILE_SCREEN_BUDGET,
  MOBILE_VIEWPORTS,
  SCREENS,
  measureEmptyCtaDockGap,
  measureScreenAllCombos,
  printResultsTable,
} from './helpers/mobileScreenBudget'

/**
 * #2094: замер мобильного бюджета экрана — все 13 экранов без мутации
 * бэкенда (`/trips/plan/:id` со своей тестовой поездкой живёт отдельно в
 * `mobile-screen-budget-trip-plan.live.spec.ts`, тот же набор метрик и общий
 * JSON). Дефолтный suite — этот файл НЕ входит ни в `LIVE_CONTRACT_SPECS`,
 * ни в `PRODUCTION_SMOKE_SPECS` (`scripts/e2e-suite-classification.js`), это
 * и есть контракт «дефолтный прогон не мутирует бэкенд, но видит все
 * экраны». Публичная подмножина повторяется в
 * `mobile-screen-budget-production-smoke.spec.ts` против прода.
 *
 * Один тест = один экран = одна навигация, все 4 комбинации (390×844 и
 * 402×874 × light/dark) снимаются поверх неё (`measureScreenAllCombos`) —
 * было 52 теста по ~9 с (7,9 мин на одном воркере), стало 13.
 *
 * Авторизованные экраны используют storageState `global-setup.ts` — нужен
 * `E2E_AUTH_MODE=required` (иначе экраны откроются гостем и упадут на
 * собственных редиректах, а не дадут тихий ложный успех).
 */

/**
 * Авторизованному экрану нужна живая веб-сессия на ЭТОМ origin. В полном прогоне
 * release:check сессия из storageState global-setup терялась по ходу (токен e2e-
 * аккаунта удаляется любым logout), и экран открывался гостем — метрики молча
 * снимались с заглушки входа. Поэтому сначала проверяем сессию, и только если
 * она мертва — входим тем же путём, что global-setup: `context.request` на origin
 * прогона (e2e-прокси ставит HttpOnly-cookie на этот хост) + витрина `userId`.
 * Вход ограничен бэкендом (`auth_login` 5/min) — отсюда проверка и повтор на 429.
 */
async function ensureLiveSession(page: Page, baseURL: string | undefined): Promise<void> {
  const base = String(baseURL || '').replace(/\/+$/, '')
  const request = page.context().request
  if ((await request.get(`${base}/api/user/me/verifications/`)).ok()) return

  const email = String(process.env.E2E_EMAIL || '').trim()
  const password = String(process.env.E2E_PASSWORD || '').trim()
  if (!email || !password || !base) {
    throw new Error('Авторизованный экран без e2e-учётки: нужны E2E_AUTH_MODE=required и E2E_EMAIL/E2E_PASSWORD')
  }
  let response = await request.post(`${base}/api/user/login/`, { data: { email, password } })
  for (let attempt = 1; response.status() === 429 && attempt <= 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt))
    response = await request.post(`${base}/api/user/login/`, { data: { email, password } })
  }
  expect(response.ok(), `вход e2e-аккаунта: ${response.status()}`).toBeTruthy()
  const json = (await response.json().catch(() => null)) as { id?: number | string } | null
  const userId = json?.id != null ? String(json.id) : ''
  expect(userId, 'вход не вернул id пользователя').toBeTruthy()
  await page.addInitScript((value: string) => {
    try {
      window.localStorage.setItem('userId', value)
    } catch {
      // ignore
    }
  }, userId)
}

test.describe('Mobile screen budget (#2094)', () => {
  for (const screen of SCREENS) {
    test(screen.key, async ({ page, baseURL }) => {
      if (screen.requiresAuth) await ensureLiveSession(page, baseURL)
      await measureScreenAllCombos(page, {
        screenKey: screen.key,
        path: screen.path,
        title: screen.title,
        viewports: MOBILE_VIEWPORTS,
        ctaTestId: screen.ctaTestId,
        budget: MOBILE_SCREEN_BUDGET[screen.key],
      })
    })
  }

  // #2104: пустая вкладка профиля — компактная заглушка `ui/EmptyState`, кнопка
  // «Создать маршрут» целиком выше дока без прокрутки. Вкладка «Опубл.»: у
  // e2e-аккаунта опубликованных маршрутов нет (черновики есть — «Маршруты» не пуста).
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`profile empty tab CTA above dock @ ${viewport.name}`, async ({ page, baseURL }) => {
      await ensureLiveSession(page, baseURL)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/profile')
      const publishedTab = page.getByRole('tab', { name: /Опубл/ }).first()
      await expect(publishedTab, 'профиль открыт гостем — нет веб-сессии на этом origin').toBeVisible({ timeout: 60_000 })
      await publishedTab.click()
      const cta = page.locator('[data-testid="empty-state-action"]').first()
      await expect(cta).toBeVisible()
      const gap = await measureEmptyCtaDockGap(page)
      console.log(`[mobile-screen-budget] profile-published-empty @ ${viewport.name}: emptyCtaDockGap=${gap}`)
      expect(gap, 'низ кнопки заглушки над доком без прокрутки').not.toBeNull()
      expect(gap as number).toBeGreaterThanOrEqual(0)
    })
  }

  test.afterAll(() => {
    printResultsTable(SCREENS.map((s) => s.key))
  })
})
