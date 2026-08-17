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
  ])('не выдаёт адрес, когда %s', (_label, item) => {
    expect(normalizeToTravel(item as Record<string, unknown>).url).toBe('')
  })
})
