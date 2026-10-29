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
  const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content') ?? ''
  return {
    counts,
    path: location.pathname,
    title: document.title,
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    ogUrl: document.head.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
    description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    ogTitle: content('meta[property="og:title"]'),
    ogDescription: content('meta[property="og:description"]'),
    twitterTitle: content('meta[name="twitter:title"]'),
    twitterDescription: content('meta[name="twitter:description"]'),
  }
}

type HeadState = ReturnType<typeof readHead>

const expectSingleHeadFor = async (
  page: import('@playwright/test').Page,
  pathname: string,
  previous?: { head: HeadState; restored?: boolean },
): Promise<HeadState> => {
  let head: HeadState | undefined
  // Head owners update after route focus. Wait for the whole coherent head,
  // rather than treating the first updated og:url as completion.
  await expect(async () => {
    head = await page.evaluate(readHead, SEO_SELECTORS)
    expect(head.path).toBe(pathname)
    for (const selector of SEO_SELECTORS) expect(head.counts[selector], selector).toBe(1)
    expect(head.ogUrl).toMatch(new RegExp(`${pathname === '/' ? '/$' : pathname}$`))
    expect(head.canonical).toBe(head.ogUrl)
    expect(head.title.trim()).not.toBe('')
    expect(head.description.trim()).not.toBe('')
    expect(head.ogTitle).toBe(head.title)
    expect(head.twitterTitle).toBe(head.title)
    expect(head.ogDescription).toBe(head.description)
    expect(head.twitterDescription).toBe(head.description)
    if (previous?.restored) {
      expect(head.title).toBe(previous.head.title)
      expect(head.description).toBe(previous.head.description)
    } else if (previous) {
      expect(head.title).not.toBe(previous.head.title)
      expect(head.description).not.toBe(previous.head.description)
    }
  }).toPass({ timeout: 15_000 })
  return head!
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

    await page.getByTestId('footer-dock-row').getByTestId('footer-item-quests').click()
    await expect(page).toHaveURL(/\/quests(?:[?#]|$)/)
    const quests = await expectSingleHeadFor(page, '/quests', { head: terms })
    expect(quests.description).not.toBe(terms.description)
    expect(quests.title).not.toBe(terms.title)

    await page.goBack()
    await expect(page).toHaveURL(/\/terms(?:[?#]|$)/)
    const back = await expectSingleHeadFor(page, '/terms', { head: terms, restored: true })
    expect(back.description).toBe(terms.description)
  })
})
