import { expect, test } from '@playwright/test'
import { preacceptCookies } from './helpers/navigation'
const { resolveE2ETargets } = require('../scripts/e2e-target-safety')

/** Real read-only catalog regression. No successful API fixture, auth login or
 * writes. The full A-create/B-view/apply/cancel/my acceptance remains a separate
 * required gate; this guest spec cannot stand in for that lifecycle.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } })

for (const locale of ['ru', 'be', 'uk', 'pl', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`cold trips retains its static catalog: ${locale}/${theme}`, async ({ page }, testInfo) => {
      const targets = resolveE2ETargets({ ...process.env, BASE_URL: testInfo.project.use.baseURL || process.env.BASE_URL })
      const expected = process.env.TRIPS_EXPECTED_SOURCE_SHA
      if (targets.productionTarget) {
        expect(expected, 'Production acceptance requires the reviewed full source SHA').toMatch(/^[a-f0-9]{40}$/)
      }
      const consoleErrors: string[] = []
      const pageErrors: string[] = []
      const failures: { url: string; error: string | null }[] = []
      const apiWrites: string[] = []
      const routeErrors: string[] = []
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
      page.on('requestfailed', (request) => failures.push({ url: request.url(), error: request.failure()?.errorText ?? null }))
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) apiWrites.push(request.method())
      })
      let releaseScripts!: () => void
      let releaseCatalog!: () => void
      const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve })
      const catalogReady = new Promise<void>((resolve) => { releaseCatalog = resolve })
      await page.route('**/_expo/static/js/web/*.js', async (route) => {
        try {
          await scriptsReady
          await route.continue()
        } catch (error) { routeErrors.push(`${route.request().url()}: ${String(error)}`) }
      })
      await page.route('**/api/public-trips/**', async (route) => {
        try {
          await catalogReady
          await route.continue()
        } catch (error) { routeErrors.push(`${route.request().url()}: ${String(error)}`) }
      })
      await preacceptCookies(page)
      await page.addInitScript(({ locale, theme }) => {
        localStorage.setItem('@metravel/locale-preference:v1', JSON.stringify({ version: 1, mode: 'explicit', locale }))
        localStorage.setItem('theme', theme)
      }, { locale, theme })
      const before = await page.request.get('/.build-source.json')
      expect(before.ok()).toBe(true)
      const sourceBefore = await before.json()
      if (expected) expect(sourceBefore.sha).toBe(expected)
      expect(sourceBefore.dirty).toBe(false)
      let staticHtml = ''
      try {
        const documentResponse = await page.goto('/trips', { waitUntil: 'commit' })
        expect(documentResponse?.status()).toBe(200)
        staticHtml = await documentResponse!.text()
        expect(staticHtml).toContain('data-testid="public-trips-catalog"')
        expect(staticHtml).toContain('data-testid="public-trips-loading"')
        expect(staticHtml).not.toContain('<!--$!-->')
        expect(staticHtml).toMatch(/rel="canonical"[^>]*\/trips|\/trips[^>]*rel="canonical"/)
        await expect(page.getByTestId('public-trips-loading')).toBeAttached()
        await page.evaluate(() => {
          ;(window as any).__coldTripCatalog = document.querySelector('[data-testid="public-trips-catalog"]')
        })
        releaseScripts()
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.getByTestId('public-trips-loading')).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('loading.png'), fullPage: false })
        const catalogResponse = page.waitForResponse((response) =>
          new URL(response.url()).pathname === '/api/public-trips/' && response.request().method() === 'GET',
        )
        releaseCatalog()
        const response = await catalogResponse
        expect(response.status()).toBe(200)
        const body = await response.json()
        const trips: { id: number }[] = Array.isArray(body) ? body : body.results
        expect(Array.isArray(trips)).toBe(true)
        await expect(page.getByTestId('public-trips-loading')).toBeHidden()
        if (trips.length) await expect(page.getByTestId(`trip-card-${trips[0].id}`)).toBeVisible()
        else await expect(page.getByTestId('public-trips-empty')).toBeVisible()
        const sameCatalog = await page.evaluate(() =>
          (window as any).__coldTripCatalog === document.querySelector('[data-testid="public-trips-catalog"]'),
        )
        expect(sameCatalog, 'hydration replaced the static catalog node').toBe(true)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/trips\/?$/)
        await expect(page).toHaveTitle(/Metravel$/)
        await page.screenshot({ path: testInfo.outputPath('content.png'), fullPage: false })
      } finally {
        releaseScripts()
        releaseCatalog()
        await page.unrouteAll({ behavior: 'wait' })
        const after = await page.request.get('/.build-source.json')
        const sourceAfter = after.ok() ? await after.json().catch((error) => ({ error: String(error) })) : null
        await testInfo.attach('cold-server-html', { body: staticHtml, contentType: 'text/html' })
        await testInfo.attach('raw-runtime', {
          body: JSON.stringify({ sourceBefore, sourceAfter, sourceAfterStatus: after.status(), locale, theme,
            consoleErrors, pageErrors, failures, apiWrites, routeErrors,
            resources: await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => {
              const resource = entry as PerformanceResourceTiming
              return { name: resource.name, initiatorType: resource.initiatorType, transferSize: resource.transferSize, encodedBodySize: resource.encodedBodySize }
            })),
          }, null, 2),
          contentType: 'application/json',
        })
        expect(after.ok()).toBe(true)
        expect(sourceAfter).toEqual(sourceBefore)
        expect(routeErrors).toEqual([])
        expect(consoleErrors).toEqual([])
        expect(pageErrors).toEqual([])
        expect(failures).toEqual([])
        expect(apiWrites).toEqual([])
      }
    })
  }
}
