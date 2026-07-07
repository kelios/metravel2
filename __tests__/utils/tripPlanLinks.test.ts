import {
  buildTripPlanCreateHref,
  buildTripPlanPrefill,
  getDefaultTripStartDate,
} from '@/utils/tripPlanLinks'

describe('tripPlanLinks', () => {
  it('uses the next Saturday as the default trip start date', () => {
    expect(getDefaultTripStartDate(new Date('2026-07-07T12:00:00'))).toBe('2026-07-11')
    expect(getDefaultTripStartDate(new Date('2026-07-11T12:00:00'))).toBe('2026-07-18')
  })

  it('builds a create link with the source travel context', () => {
    const href = buildTripPlanCreateHref({
      id: 42,
      slug: 'naroch-route',
      name: 'Нарочь',
      description: '<p>Озера и стоянки</p>',
    } as never)

    expect(href).toContain('/trips/plan/create?')
    expect(decodeURIComponent(href)).toContain('source=travel')
    expect(decodeURIComponent(href)).toContain('sourceTravelTitle=Нарочь')
    expect(decodeURIComponent(href)).toContain('https://metravel.by/travels/naroch-route')
  })

  it('creates form prefill from a source travel query', () => {
    const prefill = buildTripPlanPrefill({
      source: 'travel',
      sourceTravelTitle: 'Нарочь',
      sourceTravelUrl: 'https://metravel.by/travels/naroch-route',
      sourceTravelDescription: 'Озера и стоянки',
    })

    expect(prefill.title).toBe('Поездка по маршруту "Нарочь"')
    expect(prefill.description).toContain('Хочу организовать поездку')
    expect(prefill.description).toContain('https://metravel.by/travels/naroch-route')
  })
})
