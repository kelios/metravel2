import { test } from './fixtures'
import {
  MOBILE_SCREEN_BUDGET,
  MOBILE_VIEWPORTS,
  SCREENS,
  measureScreenAllCombos,
  printResultsTable,
} from './helpers/mobileScreenBudget'

/**
 * #2094: та же таблица метрик, что и `mobile-screen-budget.spec.ts`, но
 * только публичные экраны (`SCREENS[].isPublic`) — без входа в аккаунт.
 * Единственный файл этого замера в `PRODUCTION_SMOKE_SPECS`
 * (`scripts/e2e-suite-classification.js`): `E2E_SUITE=production-smoke`
 * гоняет его против `metravel.by`, повторяя замер на реальном проде.
 *
 * Не дублирует основной файл целиком специально: тот файл НЕ входит в
 * `PRODUCTION_SMOKE_SPECS`, иначе он выпал бы и из дефолтного локального
 * прогона (`testIgnore` дефолта — это `LIVE_CONTRACT_SPECS +
 * PRODUCTION_SMOKE_SPECS`, см. классификацию).
 *
 * Один тест = один экран = одна навигация, 4 комбинации снимаются поверх неё
 * без перезагрузки (`measureScreenAllCombos`) — см. основной файл.
 */

const PUBLIC_SCREENS = SCREENS.filter((screen) => screen.isPublic)

test.describe('Mobile screen budget — production smoke (#2094)', () => {
  for (const screen of PUBLIC_SCREENS) {
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

  test.afterAll(() => {
    printResultsTable(PUBLIC_SCREENS.map((s) => s.key))
  })
})
