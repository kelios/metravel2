import { normalizeToTravel } from '@/components/profile/travelNormalize'

// #1438: последней веткой сборки адреса был безусловный `/travels/${id}`, а `id`
// здесь вырождается в `0` на любом непригодном значении. Карточка профиля
// получала ссылку `/travels/0` — такую же 404, как `/travels/null`.
describe('normalizeToTravel: адрес путешествия', () => {
  it('строит адрес из слага', () => {
    expect(normalizeToTravel({ id: 682, slug: 'zabroshennye-dvortsy' }).url).toBe(
      '/travels/zabroshennye-dvortsy',
    )
  })

  it('строит адрес из id, когда слага нет', () => {
    expect(normalizeToTravel({ id: 682 }).url).toBe('/travels/682')
  })

  it.each([
    ['id отсутствует', {}],
    ['id null', { id: null }],
    ['id ноль', { id: 0 }],
    ['id — строка «undefined»', { id: 'undefined' }],
    ['слаг — литерал пустоты', { id: null, slug: 'null' }],
    ['серверный url ведёт в 404', { id: null, url: '/travels/null' }],
  ])('не выдаёт адрес, когда %s', (_label, item) => {
    expect(normalizeToTravel(item as Record<string, unknown>).url).toBe('')
  })

  it('здоровый id перебивает испорченные слаг и url', () => {
    expect(normalizeToTravel({ id: 77, slug: 'null', url: '/travels/undefined' }).url).toBe(
      '/travels/77',
    )
  })

  it('внешнюю ссылку не подменяет своим адресом', () => {
    expect(normalizeToTravel({ id: 77, url: 'https://example.com/travels/null' }).url).toBe(
      'https://example.com/travels/null',
    )
  })
})
