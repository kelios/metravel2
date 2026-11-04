/** @jest-environment node */

import { LIST_VIEW_PERSISTENCE } from '../../stores/listViewPersistence'

const { JSDOM } = require('jsdom')
const { buildSearchFirstResultScript } = require('../../scripts/ssg-search-first-result')
const { buildSearchSkeletonHtml } = require('../../scripts/ssg-skeletons')

const origin = 'https://metravel.by'
const cover = '/travel-image/42/conversions/first.webp'
const route = '/search'
const travel = {
  id: 42,
  slug: 'first-route',
  name: 'First <img src=evil> route',
  publish: 1,
  moderation: 1,
  travel_image_thumb_url: cover,
  media: {
    cover: {
      width: 960,
      height: 960,
      dominant_color: '#778899',
      srcset: [160, 320, 480, 640, 720, 960]
        .map((width) => `${origin}${cover}?w=${width} ${width}w`).join(', '),
    },
  },
}

async function renderSearchPreview({
  path = route,
  payload = { data: [travel] } as unknown,
  userId,
  sort,
  densityStorage,
  ready = false,
  viewport = 412,
}: {
  path?: string
  payload?: unknown
  userId?: string
  sort?: string
  densityStorage?: string
  ready?: boolean
  viewport?: number
} = {}) {
  const dom = new JSDOM(`<div id="root"></div>${buildSearchSkeletonHtml()}`, {
    url: `${origin}${path}`,
    runScripts: 'outside-only',
  })
  const { window } = dom
  Object.defineProperty(window, 'innerWidth', { value: viewport })
  const firstCard = window.document.querySelector('.ssg-search-card')
  firstCard.getBoundingClientRect = () => ({ width: 392 })
  if (userId) window.localStorage.setItem('userId', userId)
  if (sort) window.sessionStorage.setItem('metravel:catalog-sort', sort)
  if (densityStorage !== undefined) window.localStorage.setItem(LIST_VIEW_PERSISTENCE.name, densityStorage)
  if (ready) window.document.getElementById('root').setAttribute('data-first-screen-ready', 'true')
  const response = new Response(JSON.stringify(payload))
  window.__metravelTravelListPreload = { response: Promise.resolve(response) }
  window.eval(buildSearchFirstResultScript())
  await new Promise<void>((resolve) => setImmediate(resolve))
  return { dom, response }
}

describe('public search first result before React', () => {
  it('shows the canonical first card using a cloned preloaded response and bounded media ladder', async () => {
    const { dom, response } = await renderSearchPreview({
      payload: { data: [{ ...travel, id: 1, publish: false }, travel], stage: 'strict', strict_count: 1, removed_filter_keys: [] },
      densityStorage: '{"state":{"density":"comfortable"},"version":0}',
    })
    try {
      const { document } = dom.window
      const first = document.querySelector('.ssg-search-card')
      expect(first.tagName).toBe('A')
      expect(first.getAttribute('href')).toBe('/travels/first-route?returnTo=%2Fsearch')
      const title = first.querySelector('.ssg-search-card-title')
      expect(title.textContent).toBe(travel.name)
      expect(title.querySelector('img')).toBeNull()
      const image = first.querySelector('img')
      expect(image.getAttribute('sizes')).toBe('392px')
      expect(image.getAttribute('srcset')).toContain(`${origin}${cover}?w=720&q=70 720w`)
      expect(image.getAttribute('srcset')).not.toContain('960w')
      expect(await response.json()).toMatchObject({ data: [{ id: 1 }, { id: travel.id }] })
    } finally {
      dom.window.close()
    }
  })

  it.each([
    { path: '/search?q=lakes' },
    { userId: '17' },
    { sort: 'distance' },
    { densityStorage: '{"state":{"density":"compact"},"version":0}' },
    { densityStorage: '{"state":{"density":"comfortable"},"version":1}' },
    { densityStorage: '{"state":{"density":"comfortable","setDensity":null},"version":0}' },
    { densityStorage: '{"state":{},"version":0}' },
    { densityStorage: 'invalid JSON' },
    { ready: true },
    { viewport: 1440 },
    { payload: { data: [travel], stage: 'broad', strict_count: 0, removed_filter_keys: [] } },
    { payload: { data: [{ ...travel, publish: undefined, moderation: undefined, publication_status: 'draft' }, travel] } },
    { payload: { data: [{ ...travel, publish: undefined, moderation: undefined, publication_status: 'pending_review' }, travel] } },
    { payload: { data: [{ ...travel, media: null }, travel] } },
    { payload: { data: [{ ...travel, media: { cover: { srcset: 'https://example.org/photo.webp 320w' } } }] } },
  ])('keeps the normal shell when preview is ineligible: %j', async (options) => {
    const { dom, response } = await renderSearchPreview(options)
    try {
      expect(dom.window.document.querySelector('.ssg-search-card-result')).toBeNull()
      expect(response.bodyUsed).toBe(false)
    } finally {
      dom.window.close()
    }
  })
})
