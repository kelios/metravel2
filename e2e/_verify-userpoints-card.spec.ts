import { test, expect } from '@playwright/test'
import { simpleEncrypt } from './helpers/auth'

// Standalone visual verification for the redesigned UserPoints PointCard
// (photo-dominant overlay parity with travel/PointCard). Runs against the
// running Metro dev server; API traffic is proxied to prod where the QA
// account (104) has real points (7 with photos).
//
// Run: E2E_NO_WEBSERVER=1 BASE_URL=http://127.0.0.1:8081 \
//   PROD_TOKEN=<token> npx playwright test e2e/_verify-userpoints-card.spec.ts --project=chromium

const PROD = 'https://metravel.by'
const TOKEN = process.env.PROD_TOKEN || ''

async function seedAuth(page: import('@playwright/test').Page) {
  const encrypted = simpleEncrypt(TOKEN, 'metravel_encryption_key_v1')
  await page.addInitScript((enc: string) => {
    try {
      window.localStorage.setItem('secure_userToken', enc)
      window.localStorage.setItem('userId', '104')
      window.localStorage.setItem('userName', 'QA 104')
      window.localStorage.setItem('isSuperuser', 'true')
    } catch {
      /* storage unavailable — auth seed is best-effort */
    }
  }, encrypted)
}

// Route any API call (LAN or relative) to prod with the real token.
async function proxyApiToProd(page: import('@playwright/test').Page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const target = `${PROD}${url.pathname}${url.search}`
    const headers = { ...req.headers(), authorization: `Token ${TOKEN}` }
    delete (headers as any).host
    const resp = await route.fetch({ url: target, headers })
    await route.fulfill({ response: resp })
  })
}

if (TOKEN) {
  for (const vp of [
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'desktop-1280', width: 1280, height: 900 },
  ]) {
    test(`userpoints card layout @ ${vp.name}`, async ({ page }) => {
      page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await seedAuth(page)
      await proxyApiToProd(page)

      page.on('console', (m) => {
        const t = m.text()
        if (/error|auth|token|401|points/i.test(t)) console.log('CONSOLE', t.slice(0, 160))
      })

      await page.goto('/userpoints', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)

      const auth = await page.evaluate(() => ({
        tok: (window.localStorage.getItem('secure_userToken') || '').slice(0, 12),
        uid: window.localStorage.getItem('userId'),
      }))
      console.log('AUTH_STATE', JSON.stringify(auth))

      const consent = page.getByText('Принять всё', { exact: true }).first()
      if (await consent.isVisible().catch(() => false)) {
        await consent.click().catch(() => {})
      }

      // Give auth hydration + first points fetch time to settle.
      await page.waitForTimeout(5000)

      // Default view is the map; switch to the list tab to render point cards.
      const listTab = page.getByText(/Список\s*\(/).first()
      if (await listTab.isVisible().catch(() => false)) {
        await listTab.click().catch(() => {})
        await page.waitForTimeout(3500)
      }

      // Wait for a point card to appear.
      await page
        .locator('[data-testid^="userpoints-point-card-"], [testID^="userpoints-point-card-"]')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 })
        .catch(() => {})
      await page.waitForTimeout(2500)

      await page.screenshot({
        path: `e2e/__screenshots__/verify-userpoints-${vp.name}.png`,
        fullPage: false,
      })

      const anyCard = await page
        .locator('[data-testid^="userpoints-point-card-"]')
        .count()
        .catch(() => 0)
      console.log(`VERIFY ${vp.name}: cards=`, anyCard)
      expect(anyCard).toBeGreaterThan(0)
    })
  }
}
