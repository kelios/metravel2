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

test.describe('Mobile screen budget (#2094)', () => {
  for (const screen of SCREENS) {
    test(screen.key, async ({ page }) => {
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
    test(`profile empty tab CTA above dock @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/profile')
      await page.getByRole('tab', { name: /Опубл/ }).first().click()
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
