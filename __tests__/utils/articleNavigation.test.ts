import {
  buildArticlesHrefFromSource,
  normalizeArticleListSourceHref,
  normalizeArticleReturnHref,
} from '@/utils/articleNavigation'
import { buildRegistrationHref } from '@/utils/authNavigation'

describe('articleNavigation', () => {
  it('keeps only safe internal article return hrefs', () => {
    expect(normalizeArticleReturnHref('/articles?from=%2Fmap')).toBe('/articles?from=/map')
    expect(normalizeArticleReturnHref('/map#point')).toBe('/map')
    expect(normalizeArticleReturnHref('/article/1')).toBeNull()
    expect(normalizeArticleReturnHref('https://metravel.by/articles')).toBeNull()
    expect(normalizeArticleReturnHref('//metravel.by/articles')).toBeNull()
  })

  it('normalizes article list source hrefs without allowing article/list loops', () => {
    expect(normalizeArticleListSourceHref('/map')).toBe('/map')
    expect(normalizeArticleListSourceHref('/articles')).toBeNull()
    expect(normalizeArticleListSourceHref('/articles?from=%2Fmap')).toBeNull()
    expect(normalizeArticleListSourceHref('/article/1')).toBeNull()
  })

  it('builds article list href with encoded source', () => {
    expect(buildArticlesHrefFromSource('/map')).toBe('/articles?from=%2Fmap')
    expect(buildArticlesHrefFromSource('/map?mode=nearby')).toBe('/articles?from=%2Fmap%3Fmode%3Dnearby')
    expect(buildArticlesHrefFromSource('/articles')).toBe('/articles')
  })
})

describe('authNavigation registration href', () => {
  it('builds registration href with safe internal redirect and intent', () => {
    expect(buildRegistrationHref({ redirect: '/article/test?token=secret', intent: 'favorite' })).toBe(
      '/registration?redirect=%2Farticle%2Ftest%3Ftoken%3Dsecret&intent=favorite',
    )
    expect(buildRegistrationHref({ redirect: 'https://example.com/article', intent: 'favorite' })).toBe(
      '/registration?redirect=%2F&intent=favorite',
    )
  })
})
