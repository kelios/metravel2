import { render } from '@testing-library/react-native'

import BelkrajWidget from '@/components/belkraj/BelkrajWidget.native'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}))

describe('BelkrajWidget.native', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('renders the Belkraj partner widget in a native WebView', () => {
    const { getByTestId } = render(
      <BelkrajWidget
        countryCode="BY"
        points={[{ id: 1, address: 'Минск', coord: '53.9,27.56' }]}
        cardsCount={6}
      />,
    )

    const webview = getByTestId('belkraj-native-webview')
    const uri = webview.props.source.uri as string

    expect(uri).toContain('https://belkraj.by/partner/widget?')
    expect(uri).toContain('lat=53.9')
    expect(uri).toContain('lng=27.56')
    expect(uri).toContain('country=BY')
    expect(uri).toContain('partner=u180793')
    expect(uri).toContain('size=6')
  })

  it('opens non-Belkraj navigations through the shared external-link helper', () => {
    const { getByTestId } = render(
      <BelkrajWidget
        countryCode="BY"
        points={[{ id: 1, address: 'Минск', lat: 53.9, lng: 27.56 }]}
      />,
    )

    const webview = getByTestId('belkraj-native-webview')
    const shouldStart = webview.props.onShouldStartLoadWithRequest as (request: { url: string }) => boolean

    expect(shouldStart({ url: 'https://belkraj.by/partner/widget?lat=53.9' })).toBe(true)
    expect(shouldStart({ url: 'https://example.com/tour' })).toBe(false)
    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      'https://example.com/tour',
      expect.objectContaining({ allowedProtocols: ['https:'] }),
    )
  })
})
