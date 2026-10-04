import { renderHook } from '@testing-library/react-native'

import { usePopupActions } from '@/components/MapPage/Map/PlacePopupCard/usePopupActions'

jest.mock('@/utils/seo', () => ({ getSiteBaseUrl: () => 'https://metravel.by' }))

// #2144: «Статья» карточки места — хост и путь через единый строковый
// `resolveSitePath` (без `new URL`, неспецифичного на Hermes), предикат статьи —
// `isSiteArticlePath` из `utils/siteLinks.ts`; хост пути статьи — любой (#501).
describe('usePopupActions: normalizedArticleHref (#2144)', () => {
  const render = (articleHref: string | null) =>
    renderHook(() =>
      usePopupActions({ colors: {} as any, coord: '53.9, 27.56', articleHref, onOpenArticle: jest.fn() }),
    ).result.current

  it.each([
    ['/travels/slug', '/travels/slug'],
    ['https://metravel.by/travels/slug?id=7', '/travels/slug?id=7'],
    ['https://www.metravel.by/article/post#h', '/article/post#h'],
    ['http://metravel.by/travel/12', '/travel/12'],
    // #501: ссылки маркеров строятся от хоста API (dev/local) — кнопка есть.
    ['http://localhost:8000/travels/slug', '/travels/slug'],
    ['http://192.168.50.36/travel/12?id=3', '/travel/12?id=3'],
  ])('%s → %s, кнопка есть', (href, path) => {
    const actions = render(href)
    expect(actions.normalizedArticleHref).toBe(path)
    expect(actions.hasArticle).toBe(true)
  })

  it.each([
    'https://metravel.by/media/x.jpg',
    'https://example.com/media/x.jpg',
    'https://metravel.by/travels/',
    '/quests/minsk',
    '',
    null,
  ])('%s → нет статьи', (href) => {
    const actions = render(href as string | null)
    expect(actions.normalizedArticleHref).toBeNull()
    expect(actions.hasArticle).toBe(false)
  })
})
