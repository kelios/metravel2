import { test, expect, type Page } from '@playwright/test'
import { ARTICLE_REQUEST_BUDGETS } from './helpers/pagesPerfBudgets'
import { preacceptCookies } from './helpers/navigation'

const imageVariants = (urls: readonly string[]) => {
  const byFile = new Map<string, Set<string>>()
  for (const value of urls) {
    const url = new URL(value)
    if (!/quest-cover|travel-image|cover_trecime/.test(url.pathname)) continue
    const variants = byFile.get(url.pathname) ?? new Set<string>()
    variants.add(value)
    byFile.set(url.pathname, variants)
  }
  return [...byFile].filter(([, urls]) => urls.size > 1).map(([file, urls]) => ({ file, urls: [...urls] }))
}

async function scrollPage(page: Page) {
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel(0, page.viewportSize()!.height)
    await page.waitForLoadState('networkidle')
  }
}

for (const profile of [
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
]) {
  test.describe(`resource contracts ${profile.name}`, () => {
    test.use({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
      storageState: { cookies: [], origins: [] } })
    test.beforeEach(async ({ page }) => { await preacceptCookies(page) })

    for (const [key, budget] of Object.entries(ARTICLE_REQUEST_BUDGETS)) {
      test(`${key}: canonical article requests @perf`, async ({ page }, testInfo) => {
        const responses: { url: string; status: number }[] = []
        page.on('response', (response) => {
          if (new URL(response.url()).pathname.startsWith('/api/articles')) {
            responses.push({ url: response.url(), status: response.status() })
          }
        })
        await page.goto(budget.path, { waitUntil: 'networkidle' })
        await expect(page.locator('h1').first()).toBeVisible()
        if (key === 'ARTICLE_DETAIL') await expect(page.locator('.safe-html-rich-text img').first()).toBeVisible()
        await scrollPage(page)
        expect(responses.length).toBeGreaterThan(0)
        expect(responses.filter(({ status }) => status >= 300 && status < 400)).toHaveLength(budget.redirectsMax)
        expect(responses.length - new Set(responses.map(({ url }) => url)).size).toBe(budget.duplicateUrlsMax)
        expect(responses.every(({ status }) => status === 200)).toBe(true)
        if ('detailRequestsMax' in budget) {
          expect(responses.filter(({ url }) => /\/api\/articles\/\d+\/$/.test(new URL(url).pathname))).toHaveLength(budget.detailRequestsMax)
          const sources = await page.locator('.safe-html-rich-text img').evaluateAll((images) =>
            images.map((image) => (image as HTMLImageElement).currentSrc))
          expect(sources.some((url) => new URL(url).pathname.startsWith('/media-resize/uploads/'))).toBe(true)
          expect(sources.some((url) => url.includes('amazonaws.com'))).toBe(false)
        }
        const transferKB = await page.evaluate(() => performance.getEntriesByType('resource')
          .reduce((bytes, entry) => bytes + (entry as PerformanceResourceTiming).transferSize, 0) / 1024)
        expect(transferKB).toBeLessThanOrEqual(budget.totalTransferKBMax)
        await testInfo.attach('article-requests', { body: JSON.stringify({ responses, transferKB }), contentType: 'application/json' })
      })
    }

    test('home uses one effective URL per image file @perf', async ({ page }, testInfo) => {
      const urls: string[] = []
      page.on('request', (request) => { if (request.resourceType() === 'image') urls.push(request.url()) })
      await page.goto('/', { waitUntil: 'networkidle' })
      await expect(page.locator('[data-home-quest-promo]')).toBeVisible()
      await scrollPage(page)
      expect(urls.some((url) => url.includes('/quest-cover/'))).toBe(true)
      expect(imageVariants(urls)).toEqual([])
      await testInfo.attach('home-media', { body: JSON.stringify(urls), contentType: 'application/json' })
    })

    test('narrow body photos match their slots without changing full-width images @perf', async ({ page }, testInfo) => {
      await page.goto('/travels/kuda-poekhat-v-belarusi-na-vykhodnye-4-marshruta', { waitUntil: 'networkidle' })
      await scrollPage(page)
      const photos = page.locator('.img-float-left img, .img-float-right img')
      expect(await photos.count()).toBeGreaterThan(0)
      for (const photo of (await photos.all()).slice(0, 4)) {
        await photo.scrollIntoViewIfNeeded()
        await expect.poll(() => photo.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      }
      const images = await photos.evaluateAll((nodes) => nodes.map((node) => {
        const image = node as HTMLImageElement
        return { src: image.currentSrc, width: image.clientWidth, natural: image.naturalWidth }
      }).filter((image) => image.width > 0 && image.natural > 0))
      expect(images.length).toBeGreaterThan(0)
      expect(images.filter((image) => image.natural / image.width > 2)).toEqual([])
      await testInfo.attach('body-image-slots', { body: JSON.stringify(images), contentType: 'application/json' })
      await page.screenshot({ path: testInfo.outputPath('body-slots.png') })
    })
  })
}
