import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'

const travelWithPoints = {
  description: 'Описание маршрута',
  gallery: [],
  travelAddress: [{ name: 'Точка', lat: 53.9, lng: 27.56 }],
} as any

describe('buildTravelSectionLinks', () => {
  it('keeps excursions on web where the section is rendered', () => {
    const links = buildTravelSectionLinks(travelWithPoints, { platform: 'web' })

    expect(links.map((link) => link.key)).toContain('excursions')
  })

  it('keeps excursions on Android where the native section is rendered', () => {
    const links = buildTravelSectionLinks(travelWithPoints, { platform: 'android' })

    expect(links.map((link) => link.key)).toContain('excursions')
    expect(links.map((link) => link.key)).toEqual(
      expect.arrayContaining(['description', 'excursions', 'map', 'points']),
    )
  })
})
