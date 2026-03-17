import { renderHook } from '@testing-library/react-native'

import { useTravelDetailsMapSectionHintsModel } from '@/components/travel/details/hooks/useTravelDetailsMapSectionHintsModel'

describe('useTravelDetailsMapSectionHintsModel', () => {
  it('derives place hints, transport hints and coordinate flags from travel data', () => {
    const travel: any = {
      coordsMeTravel: [{ lat: 53.9, lng: 27.56 }],
      travelAddress: [
        { coord: '53.9,27.56', name: 'Минск' },
        { coord: '52.1,23.7', address: 'Брест' },
        { coord: '', name: 'Без координат' },
      ],
      transports: ['car', 'bike', 'car', 'пешком'],
    }

    const { result } = renderHook(() =>
      useTravelDetailsMapSectionHintsModel(travel)
    )

    expect(result.current.hasEmbeddedCoords).toBe(true)
    expect(result.current.hasTravelAddressPoints).toBe(true)
    expect(result.current.placeHints).toEqual([
      { name: 'Минск', coord: '53.9,27.56' },
      { name: 'Брест', coord: '52.1,23.7' },
    ])
    expect(result.current.transportHints).toEqual([
      'Машина',
      'Велосипед',
      'Пешком',
    ])
  })

  it('returns empty hints when travel has no usable places or transport tokens', () => {
    const { result } = renderHook(() =>
      useTravelDetailsMapSectionHintsModel({
        coordsMeTravel: [],
        travelAddress: [{ coord: '', name: '' }],
        transports: [null, ''],
      } as any)
    )

    expect(result.current.hasEmbeddedCoords).toBe(false)
    expect(result.current.hasTravelAddressPoints).toBe(true)
    expect(result.current.placeHints).toEqual([])
    expect(result.current.transportHints).toEqual([])
  })
})
