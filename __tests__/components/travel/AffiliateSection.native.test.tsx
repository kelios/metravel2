import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

import { AffiliateSection } from '@/components/travel/details/sections/AffiliateSection'

const styles = {
  sectionContainer: {},
  contentStable: {},
  webDeferredSection: {},
  sectionHeaderText: {},
  sectionSubtitle: {},
}

const travel = {
  id: 384,
  cityName: 'Минск',
  countryName: 'Беларусь',
  countryCode: 'BY',
  travelAddress: [{ id: 1, address: 'Минск', coord: '53.9,27.56' }],
} as any

describe('AffiliateSection native', () => {
  const originalPlatform = Platform.OS
  const originalEnv = { ...process.env }

  beforeEach(() => {
    ;(Platform as any).OS = 'ios'
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = 'test-marker'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE =
      'https://tp.media/r?marker={subid}&u={url}'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE =
      'https://tp.media/h?marker={subid}&u={url}'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env = { ...originalEnv }
  })

  it('renders partner travel offers on native when affiliate config is enabled', () => {
    const { getByText } = render(<AffiliateSection travel={travel} styles={styles} />)

    expect(getByText('Полезное в поездку')).toBeTruthy()
    expect(getByText('Экскурсии и гиды')).toBeTruthy()
    expect(getByText('Где остановиться')).toBeTruthy()
  })
})
