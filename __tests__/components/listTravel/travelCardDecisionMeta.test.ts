import { i18n } from '@/i18n'
import {
  MINSK_CARD_DISTANCE_ORIGIN,
  buildTravelCardDecisionMeta,
} from '@/components/listTravel/travelCardDecisionMeta'

describe('buildTravelCardDecisionMeta', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('joins duration and distance from Minsk', () => {
    const meta = buildTravelCardDecisionMeta({
      numberDays: 1,
      lat: MINSK_CARD_DISTANCE_ORIGIN.lat + 0.2,
      lng: MINSK_CARD_DISTANCE_ORIGIN.lng,
      origin: MINSK_CARD_DISTANCE_ORIGIN,
    })

    expect(meta.duration).toBe('1 день')
    expect(meta.distance).toMatch(/км от Минска$/)
    expect(meta.line).toBe(`${meta.duration} · ${meta.distance}`)
  })

  it('measures distance from the user when that origin is known', () => {
    const meta = buildTravelCardDecisionMeta({
      numberDays: 2,
      lat: 53.95,
      lng: 27.6,
      origin: { lat: 53.9, lng: 27.56, kind: 'user' },
    })

    expect(meta.duration).toBe('2 дня')
    expect(meta.distance).toMatch(/от вас$/)
    expect(meta.line).toContain(' · ')
  })

  it('keeps duration when the anchor is missing', () => {
    expect(buildTravelCardDecisionMeta({ numberDays: 3, lat: null, lng: null }).line).toBe('3 дня')
  })

  it('drops a zero distance and an empty duration', () => {
    const samePoint = buildTravelCardDecisionMeta({
      numberDays: 1,
      lat: MINSK_CARD_DISTANCE_ORIGIN.lat,
      lng: MINSK_CARD_DISTANCE_ORIGIN.lng,
      origin: MINSK_CARD_DISTANCE_ORIGIN,
    })
    expect(samePoint.distance).toBeNull()
    expect(samePoint.line).toBe('1 день')

    expect(buildTravelCardDecisionMeta({ numberDays: 0, lat: null, lng: null }).line).toBeNull()
    expect(buildTravelCardDecisionMeta({ numberDays: 'nope', lat: 999, lng: 10 }).line).toBeNull()
  })

  it('localizes the Minsk distance phrase', async () => {
    await i18n.changeLanguage('en')
    const meta = buildTravelCardDecisionMeta({
      numberDays: 1,
      lat: MINSK_CARD_DISTANCE_ORIGIN.lat + 0.2,
      lng: MINSK_CARD_DISTANCE_ORIGIN.lng,
      origin: MINSK_CARD_DISTANCE_ORIGIN,
    })
    expect(meta.duration).toBe('1 day')
    expect(meta.distance).toMatch(/from Minsk$/)
  })
})
