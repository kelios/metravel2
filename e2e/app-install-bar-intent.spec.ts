import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

// #2907: the install offer waits for an intent signal (quest start, offline save,
// second route, half of an article). Shown on entry it got 2.7% CTR and 36%
// dismissals, covered the home first screen and its chunk loaded on every page.
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

test.use({ viewport: { width: 375, height: 812 }, userAgent: IPHONE_UA })

test('home mobile: no app install bar and no bar chunk on the first screen', async ({ page }) => {
  await preacceptCookies(page)
  const barChunks: string[] = []
  page.on('request', (request) => {
    if (/AppInstallBar[-.]/.test(request.url())) barChunks.push(request.url())
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // The bar shares the idle gate with WebServiceWorkerCleanup, whose mount
  // writes this marker in a fresh context: once it exists, a gated bar chunk
  // would already have been requested.
  await page.waitForFunction(() => window.localStorage.getItem('__metravel_sw_disabled_migration_v1') === '1')
  await expect(page.getByTestId('app-install-bar')).toHaveCount(0)
  expect(barChunks).toEqual([])
})
