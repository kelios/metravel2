import { splitTripPlanLinkedText } from '@/components/trips/planning/TripPlanLinkedText'

describe('splitTripPlanLinkedText', () => {
  it('keeps normal text and extracts http links', () => {
    expect(splitTripPlanLinkedText('Описание https://example.com/info.')).toEqual([
      { type: 'text', text: 'Описание ' },
      { type: 'link', text: 'https://example.com/info', url: 'https://example.com/info' },
      { type: 'text', text: '.' },
    ])
  })

  it('normalizes www links to https', () => {
    expect(splitTripPlanLinkedText('Маршрут: www.example.com/gr131')).toEqual([
      { type: 'text', text: 'Маршрут: ' },
      { type: 'link', text: 'www.example.com/gr131', url: 'https://www.example.com/gr131' },
    ])
  })
})
