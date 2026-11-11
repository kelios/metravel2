import { buildTravelArticleStructuredData } from '@/utils/travelArticleJsonLd'
import { travelAuthorProfilePath, travelAuthorProfileUrl } from '@/utils/travelAuthorProfile'
import { createTravelArticleJsonLd } from '@/utils/travelSeo'

// #3237: автор статьи ссылкой ведёт на /user/<id>, и та же ссылка — `author.url`.
describe('travel author profile', () => {
  it.each([
    [{ userIds: 1 }, '/user/1'],
    [{ userIds: '12, 14' }, '/user/12'],
    [{ userIds: [7] }, '/user/7'],
    [{ user: { id: 3, name: 'Юля' } }, '/user/3'],
    [{ userIds: '', user: { id: '0' } }, null],
    [{ user: { id: 'abc' } }, null],
    [null, null],
  ])('%j → %s', (travel, expected) => {
    expect(travelAuthorProfilePath(travel as never)).toBe(expected)
  })

  // #3326: `/user/<id>` без имени в профиле отдаёт 404 + noindex — ни ссылки, ни `author.url`.
  it('drops the profile link and author.url when the loader found no named public profile', () => {
    const travel = { user: { id: 5, name: 'login5' }, userIds: 5, authorProfileLinkable: false }
    expect(travelAuthorProfilePath(travel)).toBeNull()
    expect(travelAuthorProfileUrl(travel)).toBeNull()
    const server = buildTravelArticleStructuredData({ headline: 'X', canonical: 'https://metravel.by/travels/x', travel, authorSameAs: ['https://vk.com/x'] }) as { author: Record<string, unknown> }
    expect(server.author).toEqual({ '@type': 'Person', name: 'login5' })
    const client = createTravelArticleJsonLd({ id: 5, slug: 'x', name: 'X', ...travel } as never)
    expect(client?.author).not.toHaveProperty('url')
    // Неизвестно (нет loader'а) — ссылка остаётся.
    expect(travelAuthorProfilePath({ ...travel, authorProfileLinkable: undefined })).toBe('/user/5')
  })

  it('adds author.url to the server Article JSON-LD and no sameAs without profile socials', () => {
    // Ответ API статьи «Тиволи» (прод, 11.11.2026): user = { id, name }, соцсетей нет.
    const data = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli',
      travel: { user: { id: 1, name: 'Юля Sauran' }, userIds: 1, userName: 'Юля Sauran' },
    }) as { author: Record<string, unknown> }
    expect(data.author).toEqual({ '@type': 'Person', name: 'Юля Sauran', url: 'https://metravel.by/user/1' })
    expect(data.author).not.toHaveProperty('sameAs')
  })

  it('adds sameAs only from the author public profile socials', () => {
    const data = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli',
      travel: { user: { id: 1, name: 'Юля' } }, authorSameAs: ['https://www.youtube.com/@metravelby'],
    }) as { author: Record<string, unknown> }
    expect(data.author.sameAs).toEqual(['https://www.youtube.com/@metravelby'])
  })

  it('omits author.url when the API gives no author id', () => {
    const data = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli', travel: { userName: 'Гость' },
    }) as { author: Record<string, unknown> }
    expect(data.author).toEqual({ '@type': 'Person', name: 'Гость' })
  })

  it('keeps the client Article JSON-LD on the same profile url', () => {
    const data = createTravelArticleJsonLd({ id: 5, slug: 'tivoli', name: 'Тиволи', user: { id: 1, name: 'Юля' } } as never)
    expect(data?.author).toMatchObject({ name: 'Юля', url: travelAuthorProfileUrl({ userIds: 1 }) })
  })
})
