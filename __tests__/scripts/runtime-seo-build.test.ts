/** @jest-environment node */
const { collectSeoInputs } = require('@/scripts/generate-seo-pages')

describe('code-only SSR build content boundary', () => {
  it('does not join runtime entity content or revision receipts to a code release', async () => {
    const origin = 'https://metravel.by'
    const readReceipt = jest.fn(() => { throw new Error('Content revision changed during code build') })
    const fetchJson = jest.fn(async (url: string) => {
      if (url === `${origin}/api/`) return { articles: `${origin}/api/articles/` }
      if (url.startsWith(`${origin}/api/articles/?`)) return { data: [{ id: 7, name: 'Existing noindex blog metadata' }] }
      throw new Error(`Runtime content must not be fetched at build time: ${url}`)
    })
    const inputs = await collectSeoInputs({
      apiBase: origin, candidate: true, runtimeEntities: true, readReceipt, fetchJson, pace: async () => {},
    })
    expect(readReceipt).not.toHaveBeenCalled()
    expect(inputs).toMatchObject({
      questSeoReceipt: null, quests: [], questBundles: [], localizedBundles: [],
      travels: [], travelDetails: [], rawTravelDetails: [],
      articles: [{ id: 7, name: 'Existing noindex blog metadata' }],
    })
    expect(fetchJson.mock.calls.every(([url]) => url === `${origin}/api/` || url.startsWith(`${origin}/api/articles/?`))).toBe(true)
  })
})
