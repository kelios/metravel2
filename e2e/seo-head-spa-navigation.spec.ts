import { expect, test } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #2756: после SPA-перехода в живом DOM по одному тегу каждого SEO-ключа, и все
 * они — текущей страницы. Было: `/terms` → «Квесты» оставлял description и
 * og:/twitter:* экспорта `/terms` рядом с тегами `/quests` (helmet-копии и
 * одноразовый дедуп в окне 5 с).
 */
const SEO_SELECTORS = [
  'title',
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:type"]',
  'meta[property="og:locale"]',
  'meta[property="og:site_name"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
]

const readHead = (selectors: string[]) => {
  const counts: Record<string, number> = {}
  for (const selector of selectors) counts[selector] = document.head.querySelectorAll(selector).length
  return {
    counts,
    path: location.pathname,
    title: document.title,
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    ogUrl: document.head.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
    description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  }
}

const expectSingleHeadFor = async (page: import('@playwright/test').Page, pathname: string) => {
  await expect.poll(async () => (await page.evaluate(readHead, SEO_SELECTORS)).ogUrl ?? '', { timeout: 15_000 })
    .toMatch(new RegExp(`${pathname === '/' ? '/$' : pathname}$`))
  const head = await page.evaluate(readHead, SEO_SELECTORS)
  for (const selector of SEO_SELECTORS) expect(head.counts[selector], selector).toBe(1)
  expect(head.canonical).toBe(head.ogUrl)
  return head
}

test.describe('SEO head после SPA-навигации (#2756)', () => {
  test('/terms → «Квесты» → назад: по одному тегу, значения текущей страницы', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await preacceptCookies(page)
    await page.route((url) => url.pathname === '/api/quests/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )

    await page.goto('/terms', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.documentElement.classList.contains('app-hydrated'), null, { timeout: 60_000 })
    const terms = await expectSingleHeadFor(page, '/terms')

    await page.getByTestId('footer-item-quests').click()
    await expect(page).toHaveURL(/\/quests(?:[?#]|$)/)
    const quests = await expectSingleHeadFor(page, '/quests')
    expect(quests.description).not.toBe(terms.description)
    expect(quests.title).not.toBe(terms.title)

    await page.goBack()
    await expect(page).toHaveURL(/\/terms(?:[?#]|$)/)
    const back = await expectSingleHeadFor(page, '/terms')
    expect(back.description).toBe(terms.description)
  })
})
