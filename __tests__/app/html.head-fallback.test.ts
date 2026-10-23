import fs from 'fs'
import path from 'path'
import { DESIGN_COLORS } from '@/constants/designSystem'
import { getMapSeoDescription, getMapSeoTitle } from '@/constants/mapSeo'
import { translate as i18nT } from '@/i18n'
import { getSeasonalThemeBootScript } from '@/utils/seasonalThemeBootScript'
import { SECRET_LINK_ROUTE_PATHS } from '@/utils/secretLinkRoutes'

const { injectMeta } = require('@/scripts/generate-seo-pages')
const { normalizeHeadCharset } = require('@/scripts/lib/htmlCharset')
const { normalizeMetaDescription } = require('@/scripts/lib/htmlMetaDescription')
const { getStoredTravelSeoDescription } = require('@/utils/seoText')
const DESCRIPTION_SELECTORS = ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']

// Compile the actual source getter with its production inputs, not a copied IIFE.
function loadCriticalHeadScript(): string {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
  const marker = 'const getCriticalHeadScript = '
  const start = source.indexOf(marker)
  const end = source.indexOf('\nexport default function Root', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  const getter = source.slice(start + marker.length, end).trim()
  return new Function(
    'i18nT', 'SITE_BRAND', 'MAP_TITLE', 'MAP_DESCRIPTION', 'SECRET_LINK_ROUTE_PATHS', 'DESIGN_COLORS', 'getSeasonalThemeBootScript',
    `return (${getter})()`,
  )(i18nT, 'Metravel', getMapSeoTitle(), getMapSeoDescription(), SECRET_LINK_ROUTE_PATHS, DESIGN_COLORS, getSeasonalThemeBootScript)
}

function runCriticalHead(doc: Document, pathname: string): void {
  const win = { location: { pathname }, localStorage: { getItem: () => 'light' }, matchMedia: () => ({ matches: false }) }
  // The pre-existing canonical observer is irrelevant to this synchronous parser check.
  new Function('window', 'document', 'MutationObserver', 'setTimeout', loadCriticalHeadScript())(win, doc, undefined, jest.fn())
}

function appendDescriptions(doc: Document, values: string[], marked = false): void {
  DESCRIPTION_SELECTORS.forEach((selector, index) => {
    const [, attr, value] = selector.match(/\[(name|property)="([^"]+)"\]/)!
    const el = doc.createElement('meta')
    el.setAttribute(attr, value)
    el.setAttribute('content', values[index])
    if (marked) el.setAttribute('data-ssg-description', 'true')
    doc.head.appendChild(el)
  })
}

describe('critical head fallback', () => {
  it.each(['ordinary', 'generic-prefix'])('preserves one SSG description per owner before the app loads (%s), with charset first and descriptions before the script', kind => {
    const stored = kind === 'ordinary'
      ? 'Прогулка по старому городу: замок, набережная и тихие улицы. Советы для самостоятельной поездки.'
      : `${i18nT('seoStatic:critical.generic.platformDescriptionPrefix')} для прогулок по Минску и самостоятельных поездок по Беларуси.`
    const description = getStoredTravelSeoDescription(stored)
    expect(description).toBe(stored)
    const title = 'Прогулка по Минску | Metravel'
    const canonical = 'https://metravel.by/travels/minsk'
    const criticalScript = `<script id="critical-head-test">${loadCriticalHeadScript()}</script>`
    const base = `<html><head><meta charset="utf-8"/><title>Old</title>${criticalScript}</head><body></body></html>`
    const html = normalizeMetaDescription(normalizeHeadCharset(injectMeta(base, { title, description, canonical })))
    const scriptOffset = html.indexOf('<script id="critical-head-test">')
    const doc = new DOMParser().parseFromString(`${html.slice(0, scriptOffset)}</head><body></body></html>`, 'text/html')

    expect(html).toMatch(/^<html><head><meta charset="utf-8"\/>/)
    expect(html.match(/data-ssg-description="true"/g)).toHaveLength(3)
    for (const selector of DESCRIPTION_SELECTORS) {
      const rendered = new DOMParser().parseFromString(html, 'text/html').querySelectorAll(selector)
      expect(rendered).toHaveLength(1)
      expect(rendered[0].getAttribute('data-ssg-description')).toBe('true')
      const metaOffset = html.indexOf(rendered[0].outerHTML.replace(/>$/, '/>'))
      expect(metaOffset).toBeGreaterThanOrEqual(0)
      expect(metaOffset).toBeLessThan(scriptOffset)
      expect(doc.querySelectorAll(selector)).toHaveLength(1)
    }
    runCriticalHead(doc, '/travels/minsk')

    for (const selector of DESCRIPTION_SELECTORS) {
      expect(doc.querySelectorAll(selector)).toHaveLength(1)
      expect(doc.querySelector(selector)?.getAttribute('content')).toBe(description)
    }
    expect(doc.title).toBe(title)
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
  })

  it('keeps non-generic descriptions already present in each head owner', () => {
    const doc = document.implementation.createHTMLDocument('SSG title')
    const descriptions = ['Main article description', 'Open Graph description', 'Twitter description']
    appendDescriptions(doc, descriptions)
    runCriticalHead(doc, '/travels/minsk')
    DESCRIPTION_SELECTORS.forEach((selector, index) => {
      expect(doc.querySelectorAll(selector)).toHaveLength(1)
      expect(doc.querySelector(selector)?.getAttribute('content')).toBe(descriptions[index])
    })
  })

  it('retains the old fallback for the same generic-prefix text without SSG provenance', () => {
    const doc = document.implementation.createHTMLDocument('Metravel')
    const generic = `${i18nT('seoStatic:critical.generic.platformDescriptionPrefix')} для прогулок по Минску и самостоятельных поездок по Беларуси.`
    appendDescriptions(doc, [generic, generic, generic])
    runCriticalHead(doc, '/travels/old-town')
    const expected = i18nT('seoStatic:critical.travel.descriptionPrefix').replace('{{value1}}', 'Old town')
    for (const selector of DESCRIPTION_SELECTORS) expect(doc.querySelector(selector)?.getAttribute('content')).toBe(expected)
  })

  it.each(['', '   ', '\u00a0'])('does not freeze a blank marked description (%p)', blank => {
    const doc = document.implementation.createHTMLDocument('Metravel')
    appendDescriptions(doc, [blank, blank, blank], true)
    runCriticalHead(doc, '/travels/old-town')
    const expected = i18nT('seoStatic:critical.travel.descriptionPrefix').replace('{{value1}}', 'Old town')
    for (const selector of DESCRIPTION_SELECTORS) expect(doc.querySelector(selector)?.getAttribute('content')).toBe(expected)
  })

  it.each([
    ['/', 'seoStatic:root.home.description'],
    ['/search', 'seoStatic:root.search.description'],
    ['/map', null],
    ['/articles', 'seoStatic:root.articles.description'],
    ['/quests', 'seoStatic:root.quests.description'],
    ['/profile', 'seoStatic:root.default.description'],
  ])('retains absent and generic description fallbacks for %s', (pathname, translationKey) => {
    const expected = translationKey ? i18nT(translationKey) : getMapSeoDescription()
    for (const existing of ['', i18nT('seoStatic:critical.generic.loadingDescription')]) {
      const doc = document.implementation.createHTMLDocument('Metravel')
      if (existing) appendDescriptions(doc, [existing, existing, existing])
      runCriticalHead(doc, pathname)
      for (const selector of DESCRIPTION_SELECTORS) {
        expect(doc.querySelectorAll(selector)).toHaveLength(1)
        expect(doc.querySelector(selector)?.getAttribute('content')).toBe(expected)
      }
      if (pathname === '/profile') expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    }
  })

  it.each([
    ['/travels/old-town', 'seoStatic:critical.travel.descriptionPrefix'],
    ['/article/old-town', 'seoStatic:critical.article.descriptionPrefix'],
  ])('retains the named route fallback for %s', (pathname, translationKey) => {
    const doc = document.implementation.createHTMLDocument('Metravel')
    runCriticalHead(doc, pathname)
    const expected = i18nT(translationKey).replace('{{value1}}', 'Old town')
    for (const selector of DESCRIPTION_SELECTORS) expect(doc.querySelector(selector)?.getAttribute('content')).toBe(expected)
  })

  it('keeps explicit home title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const HOME_TITLE = i18nT('seoStatic:root.home.title')")
    expect(source).toContain("const HOME_DESCRIPTION = i18nT('seoStatic:root.home.description')")
    expect(source).toContain("meta[name=\"description\"]")
    expect(source).not.toContain('Идеи поездок на выходные и книга путешествий | Metravel')
    expect(source).not.toContain('собирайте красивую книгу поездок в PDF')
  })

  it('keeps dedicated article fallback title and description in +html fallback script', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("const ARTICLE_FALLBACK_TITLE = i18nT('seoStatic:root.article.title')")
    expect(source).toContain("const ARTICLE_FALLBACK_DESCRIPTION = i18nT('seoStatic:root.article.description')")
    expect(source).toContain("p.indexOf('/article/')===0")
  })

  it('replaces generic travel title/description fallbacks and noindexes service routes early', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("i18nT('seoStatic:critical.generic.travelTitle')")
    expect(source).toContain("i18nT('seoStatic:critical.generic.loadingDescription')")
    expect(source).toContain("normalized==='/travel/new'")
    expect(source).toContain("normalized==='/travels/create'")
    expect(source).toContain("isAssetLikePath(path)")
    expect(source).toContain("upsertMeta('meta[name=\"robots\"]',{name:'robots'},routeMeta.robots||'noindex, nofollow')")
  })

  it('allows large image previews on production pages', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("isProduction ? 'max-image-preview:large' : 'noindex,nofollow'")
  })

  it('keeps browser zoom available in the web viewport contract', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain('viewport-fit=cover,maximum-scale=5')
    expect(source).not.toContain('user-scalable=no')
    expect(source).not.toContain('maximum-scale=1')
  })

  it('wires the shared map head bootstrap script for early CSS and tile preconnect', () => {
    const filePath = path.resolve(process.cwd(), 'app/+html.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain("import { buildMapHeadBootstrapScript } from '@/utils/mapHeadBootstrap'")
    expect(source).toContain('buildMapHeadBootstrapScript()')
    expect(source.indexOf('getStorageHardeningScript()')).toBeLessThan(
      source.indexOf('buildMapHeadBootstrapScript()'),
    )
    expect(source.indexOf('buildMapHeadBootstrapScript()')).toBeLessThan(
      source.indexOf('getCriticalHeadScript()'),
    )
  })
})
