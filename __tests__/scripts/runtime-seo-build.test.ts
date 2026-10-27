/** @jest-environment node */
const { fetchArticleMetadata } = require('@/scripts/postprocess-route-shells')

describe('code-only SSR build content boundary', () => {
  it('reads only the legacy noindex blog metadata; runtime entity content never joins a code release', async () => {
    const origin = 'https://metravel.by'
    const fetchJson = jest.fn(async (url: string) => {
      if (url === `${origin}/api/`) return { articles: `${origin}/api/articles/` }
      if (url.startsWith(`${origin}/api/articles/?`)) return { data: [{ id: 7, name: 'Existing noindex blog metadata' }] }
      throw new Error(`Runtime content must not be fetched at build time: ${url}`)
    })
    const articles = await fetchArticleMetadata({ apiBase: origin, fetchJson, pace: async () => {} })
    expect(articles).toEqual([{ id: 7, name: 'Existing noindex blog metadata' }])
    expect(fetchJson.mock.calls.every(([url]) => url === `${origin}/api/` || url.startsWith(`${origin}/api/articles/?`))).toBe(true)
  })

  it('keeps the build free of entity, receipt and capture readers', () => {
    const source = require('fs').readFileSync(require('path').resolve('scripts/postprocess-route-shells.js'), 'utf8')
    for (const endpoint of ['/api/travels', '/api/quests', 'quest-seo', 'seoInputsCapture', 'questLocalePackage']) {
      expect(source).not.toContain(endpoint)
    }
  })
})
