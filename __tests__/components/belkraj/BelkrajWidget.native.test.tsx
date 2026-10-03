import { readFileSync } from 'fs'
import path from 'path'
import { fireEvent, render } from '@testing-library/react-native'

import BelkrajWidget from '@/components/belkraj/BelkrajWidget.native'
import { openExternalUrl } from '@/utils/externalLinks'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(async () => true),
}))

const mockOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>

const pressCard = (getByTestId: (id: string) => unknown) => {
  fireEvent.press(getByTestId('belkraj-native-link-card') as never)
  return mockOpenExternalUrl.mock.calls[0]?.[0] as string
}

// #2135 / App Review 5.1.2(i): документ виджета belkraj.by подключает GTM
// партнёра, страницы экскурсий — GTM с Facebook Pixel, Google Ads, GA4 и cookie
// `Drupal.visitor.utm_*`. На native подборка открывается во внешнем браузере
// карточкой-ссылкой, WebView с сайтом партнёра в приложении нет.
describe('BelkrajWidget.native — карточка-ссылка во внешний браузер', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('не импортирует react-native-webview: страница партнёра в приложении не грузится', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../components/belkraj/BelkrajWidget.native.tsx'),
      'utf8',
    )

    expect(source).not.toMatch(/['"]react-native-webview['"]/)
  })

  it('opens the partner selection for the first point in the external browser', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <BelkrajWidget
        countryCode="BY"
        points={[{ id: 1, address: 'Минск', coord: '53.9,27.56' }]}
        cardsCount={6}
      />,
    )

    expect(queryByTestId('belkraj-native-webview')).toBeNull()
    expect(getByTestId('belkraj-native-link-card').props.accessibilityRole).toBe('link')
    expect(getByText('belkraj.by')).toBeTruthy()
    expect(getByText('Экскурсии рядом с этим местом')).toBeTruthy()
    expect(getByText('Открыть подборку belkraj.by в браузере')).toBeTruthy()

    const url = pressCard(getByTestId)

    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(url, { allowedProtocols: ['https:'] })
    expect(url).toBe(
      'https://belkraj.by/partner/widget?lat=53.9&lng=27.56&term=place&theme=cards&partner=u180793&size=6&country=BY',
    )
  })

  it('passes the real country code of a supported non-Belarus point', () => {
    // Ключевое поведение #1460: подборка открыта не только для BY, а для любой
    // страны каталога, и в URL уходит реальный код страны точки (без него
    // tripvenue промахивается городом). Варшава/PL — реальный кейс с прода.
    const { getByTestId } = render(
      <BelkrajWidget
        countryCode="PL"
        points={[{ id: 1, address: 'Варшава', lat: 52.2297, lng: 21.0122 }]}
        cardsCount={6}
      />,
    )

    const url = pressCard(getByTestId)

    expect(url).toContain('country=PL')
    expect(url).toContain('lat=52.2297')
    expect(url).toContain('lng=21.0122')
    expect(url).not.toContain('widgetId=')
  })

  it('stays closed for a country outside the partner catalog', () => {
    // Кипр в каталоге нет — виджет отвечает подменой на Минск, поэтому секция
    // не рисуется вовсе (иначе игрок увидит минские экскурсии под кипрским местом).
    const { queryByTestId } = render(
      <BelkrajWidget
        countryCode="CY"
        points={[{ id: 1, address: 'Лимасол', lat: 34.7071, lng: 33.0226 }]}
        cardsCount={6}
      />,
    )

    expect(queryByTestId('belkraj-native-link-card')).toBeNull()
  })

  it('stays closed outside production builds, like the web iframe', () => {
    process.env.NODE_ENV = 'development'

    const { queryByTestId } = render(
      <BelkrajWidget countryCode="BY" points={[{ id: 1, address: 'Минск', lat: 53.9, lng: 27.56 }]} />,
    )

    expect(queryByTestId('belkraj-native-link-card')).toBeNull()
  })
})
