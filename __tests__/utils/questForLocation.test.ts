import {
  findQuestsNearLocation,
  parseTravelCoords,
} from '@/utils/questForLocation'
import type { QuestMeta } from '@/utils/questAdapters'

const baseQuest: QuestMeta = {
  id: 'krakow-dragon',
  title: 'Тайна Краковского дракона',
  points: 9,
  cityId: '1',
  cityName: 'Краков',
  countryName: 'Польша',
  countryCode: 'pl',
  lat: 50.0614,
  lng: 19.9366,
  durationMin: 120,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
}

describe('questForLocation', () => {
  it('parses travel coordinates from API-compatible coordinate fields', () => {
    expect(
      parseTravelCoords([
        { coords: '50.0615,19.9370' },
        { coord: '50.0615,19.9370' },
        { lat: 50.062, lng: 19.938 },
        '50.063,19.939',
      ]),
    ).toEqual([
      { lat: 50.0615, lng: 19.937 },
      { lat: 50.062, lng: 19.938 },
      { lat: 50.063, lng: 19.939 },
    ])
  })

  it('keeps runtime nearby matching aligned with SSG travel quest promo matching', () => {
    const matches = findQuestsNearLocation(
      [baseQuest],
      {
        countryName: 'Польша',
        countryCode: 'pl',
        coords: parseTravelCoords([{ coords: '50.35,19.90' }]),
      },
      { limit: 6 },
    )

    expect(matches).toHaveLength(1)
    expect(matches[0].quest.id).toBe('krakow-dragon')
  })
})
