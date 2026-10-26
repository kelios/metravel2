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

// #2776: прод `/api/travels/search_travels_for_map/` у legacy-точки без
// `place_id` кладёт в `name` название статьи, а имя места — в `address`.
describe('buildPlaceTitleParts — article title is not the place title (#2776)', () => {
  const legacyPoint = {
    id: 1201,
    place_id: null,
    name: 'Раков',
    title: 'Раков',
    address: 'Костёл Святого Михаила Архангела в Ивенце (1741–1749)',
    primary_source: { source_id: '1201', point_id: 1201, travel_id: 90, article_title: 'Раков' },
  }

  it('titles the card with the place and moves the article to sourceTitle', () => {
    expect(buildPlaceTitleParts(legacyPoint)).toEqual({
      title: 'Костёл Святого Михаила Архангела в Ивенце (1741–1749)',
      sourceTitle: 'Раков',
    })
  })

  it('recognises the article by the normalized primarySource and by the legacy title alone', () => {
    expect(buildPlaceTitleParts({
      name: 'Раков',
      address: 'Церковь Вознесения Господня в Яршевичах',
      primarySource: { articleTitle: 'Раков' },
    }).title).toBe('Церковь Вознесения Господня в Яршевичах')
    expect(buildPlaceTitleParts({
      name: 'Река Ислочь: где гулять',
      title: 'Река Ислочь: где гулять',
      address: 'Парковка у дороги Н8331 к Ислочи у Междуречья',
    })).toEqual({
      title: 'Парковка у дороги Н8331 к Ислочи у Междуречья',
      sourceTitle: 'Река Ислочь: где гулять',
    })
  })

  it('keeps the name of a canonical place even when it equals the article title', () => {
    expect(buildPlaceTitleParts({
      place_id: '01409e46-0000-0000-0000-000000000000',
      name: 'Мирский замок',
      title: 'Мирский замок',
      address: 'Мир, Гродненская область',
    })).toEqual({ title: 'Мирский замок', subtitle: 'Мир, Гродненская область' })
  })

  it('keeps the article title when the point has no own address to show instead', () => {
    expect(buildPlaceTitleParts({ name: 'Раков', title: 'Раков' })).toEqual({ title: 'Раков' })
  })
})
