import { normalizeCatalogPlaces } from '@/utils/placesCatalog'
import type { TravelCoords } from '@/types/types'

const makePlace = (overrides: Partial<TravelCoords> = {}): TravelCoords => ({
  address: 'Мирский замок, Мир, Беларусь',
  categoryName: 'Замок',
  coord: '53.4514,26.4728',
  lat: '53.4514',
  lng: '26.4728',
  travelImageThumbUrl: '',
  urlTravel: '/travels/mir',
  ...overrides,
})

describe('placesCatalog', () => {
  it('does not use coordinate-only labels as place titles', () => {
    const [place] = normalizeCatalogPlaces([
      makePlace({
        address: '52.9654099, 29.7841898',
        categoryName: 'Дворец',
        lat: '52.9654099',
        lng: '29.7841898',
      }),
    ])

    expect(place.title).toBe('Дворец без названия')
  })

  it('does not use coordinate-pair names as place titles', () => {
    const [place] = normalizeCatalogPlaces([
      makePlace({
        name: '52.9654099, 29.7841898',
        address: '52.9654099, 29.7841898',
        categoryName: 'Дворец',
        lat: '52.9654099',
        lng: '29.7841898',
      } as Partial<TravelCoords>),
    ])

    expect(place.title).toBe('Дворец без названия')
  })

  it('uses readable address parts after junk marker labels', () => {
    const [place] = normalizeCatalogPlaces([
      makePlace({
        address: '№7, Башня замка, Смольяны, Беларусь',
        categoryName: 'Руины замка',
      }),
    ])

    expect(place.title).toBe('Башня замка, Смольяны')
  })
})
