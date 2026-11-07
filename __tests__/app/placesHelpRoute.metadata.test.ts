jest.mock('@/components/places/PlaceRequestsScreen', () => () => null)
jest.mock('@/components/screens/NotFoundContent', () => ({ NotFoundContent: () => null }))

const mockIsPilotEnabled = jest.fn(() => true)
jest.mock('@/utils/placeRequestsConfig', () => ({
  isPlaceRequestsPilotEnabled: () => mockIsPilotEnabled(),
}))

const { generateMetadata } = require('@/app/(tabs)/places/help') as typeof import('@/app/(tabs)/places/help')

/**
 * #3098: подборка «Допишем Беларусь вместе» открыта для индексирования после
 * редакционной приёмки восьми приглашений. До этого маршрут нёс `noindex, follow`
 * (#3095); SSR-метаданные и клиентский `InstantSEO` обязаны совпадать.
 */
describe('/places/help route metadata (#3098)', () => {
  beforeEach(() => {
    mockIsPilotEnabled.mockReturnValue(true)
  })

  it('is indexable with a single canonical once the pilot is live', () => {
    const metadata = generateMetadata()
    expect(metadata.robots).toBeUndefined()
    expect(metadata.alternates?.canonical).toBe('https://metravel.by/places/help')
    expect(metadata.title).toContain('MeTravel')
    expect((metadata.description ?? '').length).toBeGreaterThanOrEqual(80)
  })

  it('falls back to the noindex not-found head while the pilot is switched off', () => {
    mockIsPilotEnabled.mockReturnValue(false)
    const metadata = generateMetadata()
    expect(metadata.robots).toBe('noindex, nofollow')
  })
})
