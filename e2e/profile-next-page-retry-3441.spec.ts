import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { mobileProfile } from './helpers/mobileProfile'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

// Browser-only fault injection for the authenticated author's list. The first
// response comes from local API8000; no backend or production state is changed.
const profiles = [
  { name: 'mobile', options: mobileProfile() },
  { name: 'desktop', options: { viewport: { width: 1440, height: 900 } } },
]
const cardSelector = '[data-testid^="travel-card-pagination-3441-"]:not([data-testid$="-safety-menu"])'

type ListProbe = { page2Requests: number; allowPage2: boolean; failFirstPage: boolean; page1Requests: number }

async function interceptAuthorList(page: Page, probe: ListProbe) {
  let template: Record<string, unknown> | undefined
  await page.route(url => url.pathname === '/api/travels/' && url.searchParams.has('where'), async route => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = new URL(route.request().url())
    const where = JSON.parse(url.searchParams.get('where') || '{}') as { user_id?: string; publication_status?: string[] }
    const owner = await page.evaluate(() => localStorage.getItem('userId'))
    // Counter probes, other authors and publication slices remain live.
    if (!owner || String(where.user_id) !== owner || where.publication_status || url.searchParams.get('perPage') !== '20') {
      return route.fallback()
    }
    const pageNumber = Number(url.searchParams.get('page') || 1)
    if (!template) {
      const response = await route.fetch({ headers: await route.request().allHeaders() })
      expect(response.ok(), 'local author list must be healthy before browser-only injection').toBe(true)
      const payload = await response.json()
      const rows = Array.isArray(payload) ? payload : payload.data ?? payload.results ?? payload.items
      expect(Array.isArray(rows) && rows.length > 0, 'local authenticated author needs at least one real route').toBe(true)
      template = rows[0] as Record<string, unknown>
    }
    if (pageNumber === 1) probe.page1Requests += 1
    if (pageNumber === 2) probe.page2Requests += 1
    if ((pageNumber === 1 && probe.failFirstPage) || (pageNumber === 2 && !probe.allowPage2)) {
      return route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Service Unavailable</h1>' })
    }
    const start = (pageNumber - 1) * 20
    const data = Array.from({ length: Math.min(20, Math.max(0, 45 - start)) }, (_, index) => {
      const number = start + index + 1
      return {
        ...template,
        id: 3441000 + number,
        slug: `pagination-3441-${number}`,
        url: `/travels/pagination-3441-${number}`,
        name: `Pagination route ${number}`,
      }
    })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, total: 45, count: 45 }) })
  })
}

async function scrollListEnd(page: Page) {
  await page.getByTestId('profile-travel-list').evaluate(list => {
    for (let node = list.parentElement; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) {
        node.scrollTop = node.scrollHeight
        return
      }
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
}

function captureErrors(page: Page) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  return { pageErrors, consoleErrors }
}

async function attachProbe(info: TestInfo, probe: ListProbe, errors: ReturnType<typeof captureErrors>) {
  await info.attach('pagination-evidence', { body: JSON.stringify({ ...probe, ...errors }, null, 2), contentType: 'application/json' })
  expect(errors.pageErrors).toEqual([])
  // The injected 503 is expected; all other console errors remain failures.
  expect(errors.consoleErrors.filter(message => !/503|Service Unavailable/.test(message))).toEqual([])
}

for (const profile of profiles) {
  test.describe(`#3441 ${profile.name}`, () => {
    test.use(profile.options)
    test.beforeEach(async ({ page }) => {
      const apiUrl = new URL(process.env.E2E_API_URL || 'http://not-configured.invalid')
      expect(['localhost', '127.0.0.1'], 'fault injection requires an explicit loopback API').toContain(apiUrl.hostname)
      expect(apiUrl.protocol).toBe('http:')
      expect(apiUrl.port).toBe('8000')
      await preacceptCookies(page)
    })

    test('persistent footer, repeated 503, same-page retry appends 20 → 40 cards', async ({ page }, info) => {
      const probe: ListProbe = { page2Requests: 0, allowPage2: false, failFirstPage: false, page1Requests: 0 }
      const errors = captureErrors(page)
      await interceptAuthorList(page, probe)
      await gotoWithRetry(page, '/profile')
      const cards = page.locator(cardSelector)
      await expect(cards).toHaveCount(20, { timeout: 20_000 })
      await scrollListEnd(page)
      const footer = page.getByTestId('profile-next-page-error')
      const retry = page.getByTestId('profile-next-page-retry')
      await expect(footer).toBeVisible()
      await expect(footer).toContainText('503')
      await expect(retry).toHaveCount(1)
      const footerShownAt = Date.now()
      // Persistence beyond the old toast lifetime is the assertion itself.
      await expect.poll(async () => {
        await expect(retry).toBeVisible()
        return Date.now() - footerShownAt
      }, { timeout: 6500, intervals: [250] }).toBeGreaterThan(4500)
      await expect(retry).toBeVisible()
      await expect(cards).toHaveCount(20)
      expect(probe.page2Requests).toBe(1)
      await page.screenshot({ path: info.outputPath('persistent-footer.png'), fullPage: false })

      await retry.click()
      await expect.poll(() => probe.page2Requests).toBe(2)
      await expect(retry).toBeVisible()
      await expect(retry).toHaveCount(1)
      await expect(cards).toHaveCount(20)
      probe.allowPage2 = true
      await retry.click()
      await expect(cards).toHaveCount(40)
      await expect(retry).toHaveCount(0)
      expect(probe.page2Requests).toBe(3)
      expect(probe.page1Requests).toBe(1)
      await page.screenshot({ path: info.outputPath('recovered-list.png'), fullPage: false })
      await attachProbe(info, probe, errors)
    })

    test('empty first-page error keeps its existing retry and no next-page footer', async ({ page }, info) => {
      const probe: ListProbe = { page2Requests: 0, allowPage2: false, failFirstPage: true, page1Requests: 0 }
      const errors = captureErrors(page)
      await interceptAuthorList(page, probe)
      await gotoWithRetry(page, '/profile')
      const retry = page.getByRole('button', { name: 'Повторить', exact: true })
      await expect(retry).toBeVisible()
      await expect(page.getByTestId('profile-next-page-retry')).toHaveCount(0)
      await expect(page.locator(cardSelector)).toHaveCount(0)
      probe.failFirstPage = false
      await retry.click()
      await expect(page.locator(cardSelector)).toHaveCount(20)
      expect(probe.page1Requests).toBe(2)
      expect(probe.page2Requests).toBe(0)
      await attachProbe(info, probe, errors)
    })
  })
}
