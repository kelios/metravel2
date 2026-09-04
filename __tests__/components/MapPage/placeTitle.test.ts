import { buildPlaceTitleParts } from '@/components/MapPage/Map/placeTitle'

describe('buildPlaceTitleParts (#224 — clean nearby-place titles)', () => {
  it('uses an explicit POI name as the title and the deduped address as subtitle', () => {
    const parts = buildPlaceTitleParts({
      name: 'Wawel',
      address: 'Wawel, Podzamcze, Old Town, Stare Miasto, Old Town, Краков, Малопольское воеводство',
    })
    expect(parts.title).toBe('Wawel')
    // Repeated «Old Town» collapsed; name not duplicated into the subtitle.
    expect(parts.subtitle).toBe('Wawel, Podzamcze, Old Town, Stare Miasto, Краков, Малопольское воеводство')
  })

  it('drops leading numeric noise (house/postal numbers) when no name is present', () => {
    const parts = buildPlaceTitleParts({
      address: '3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, 31-042',
    })
    expect(parts.title).toBe('Рыночная площадь')
    expect(parts.subtitle).toBe('3, Old Town, Краков, Малопольское воеводство, 31-042')
  })

  it('takes the first segment as the title for a name-less address', () => {
    const parts = buildPlaceTitleParts({
      address: 'Kościół pw. Świętej Trójcy, Dominikańska, Old Town, Stare Miasto',
    })
    expect(parts.title).toBe('Kościół pw. Świętej Trójcy')
    expect(parts.subtitle).toBe('Dominikańska, Old Town, Stare Miasto')
  })

  it('emits no subtitle when name equals the address', () => {
    const parts = buildPlaceTitleParts({ name: 'Краков', address: 'Краков' })
    expect(parts.title).toBe('Краков')
    expect(parts.subtitle).toBeUndefined()
  })

  it('falls back to a placeholder when nothing is provided', () => {
    expect(buildPlaceTitleParts({})).toEqual({ title: 'Точка маршрута' })
  })
})

describe('buildPlaceTitleParts (#1750 — цепочка геокодера через « · »)', () => {
  const DOT_CHAIN = '332 · Soblówka · Силезское воеводство · Живецкий повят · Польша'

  it('разбирает точку, сохранённую до #1717: заголовок — имя объекта, а не вся цепочка', () => {
    const parts = buildPlaceTitleParts({ address: DOT_CHAIN })
    expect(parts.title).toBe('Soblówka')
    expect(parts.subtitle).toBe('332, Силезское воеводство, Живецкий повят, Польша')
  })

  it('укорачивает и `name`, если цепочкой оказалось оно', () => {
    const parts = buildPlaceTitleParts({ name: DOT_CHAIN, address: DOT_CHAIN })
    expect(parts.title).toBe('Soblówka')
  })

  it('короткое название без разделителей не трогает — вызов идемпотентен', () => {
    expect(buildPlaceTitleParts({ name: 'Soblówka' })).toEqual({ title: 'Soblówka' })
    expect(buildPlaceTitleParts({ address: 'Bacówka PTTK na Rycerzowej' })).toEqual({
      title: 'Bacówka PTTK na Rycerzowej',
    })
  })
})
