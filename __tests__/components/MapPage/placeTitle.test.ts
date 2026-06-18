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
