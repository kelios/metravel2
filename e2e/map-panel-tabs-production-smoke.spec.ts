import { test } from './fixtures'
import {
  MAP_PANEL_TABS_LOCALES,
  MAP_PANEL_TABS_VIEWPORTS,
  assertMapLayersCardCloseReachable,
  assertMapPanelTabsContract,
  openMapForPanelTabs,
} from './helpers/mapPanelTabs'

/**
 * #2217: the `/map` panel header tabs on the production build — every
 * desktop-branch size (768 × 1024, 820 × 1180, 1180 × 820, 1440 × 900 and
 * 1440 × 900 with the 320 panel) in RU/BE/UK/PL/EN, with the count above the
 * cap («999+»). Contract and mocks — `e2e/helpers/mapPanelTabs.ts`; the same
 * check runs in the default suite at 820 × 1180 (`map-page.spec.ts`).
 *
 * Listed in `PRODUCTION_SMOKE_SPECS` (`scripts/e2e-suite-classification.js`),
 * read-only: the map search is answered inside the browser, nothing is written.
 *
 *   E2E_SUITE=production-smoke E2E_ALLOW_PRODUCTION_API=1 E2E_NO_WEBSERVER=1 \
 *   BASE_URL=https://metravel.by E2E_API_URL=https://metravel.by \
 *   npx playwright test e2e/map-panel-tabs-production-smoke.spec.ts --project=chromium
 */
test.describe('Map panel header tabs — production smoke (#2217)', () => {
  // Guest: `/map` is public, and a session is not part of this contract.
  test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

  for (const viewport of MAP_PANEL_TABS_VIEWPORTS) {
    for (const locale of MAP_PANEL_TABS_LOCALES) {
      test(`${viewport.name} ${locale}`, async ({ page }) => {
        test.setTimeout(120_000)
        await openMapForPanelTabs(page, { viewport, locale })
        await assertMapPanelTabsContract(page, `${viewport.name} ${locale}`)
      })
    }
  }

  // The on-map cluster is the same at every size: one pass at 820 × 1180.
  test('«Слои» card «×» is reachable; «Подсказки» steps aside', async ({ page }) => {
    test.setTimeout(120_000)
    const viewport = MAP_PANEL_TABS_VIEWPORTS.find((item) => item.width === 820) ?? MAP_PANEL_TABS_VIEWPORTS[0]
    await openMapForPanelTabs(page, { viewport, locale: 'ru' })
    await assertMapLayersCardCloseReachable(page, `${viewport.name} ru`)
  })
})
