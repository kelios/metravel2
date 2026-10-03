import { BELKRAJ_ORIGIN, BELKRAJ_PARTNER_ID, buildBelkrajWidgetUrl } from '@/components/belkraj/belkrajWidgetUrl'

// Один адрес подборки для web-iframe и native-ссылки (#2135): порядок и состав
// параметров web-iframe не меняются (байт-в-байт прежний src).
describe('buildBelkrajWidgetUrl', () => {
  it('builds the web iframe src with country and widgetId in the established order', () => {
    expect(
      buildBelkrajWidgetUrl({ coord: { lat: 53.9, lng: 27.56 }, countryCode: 'BY', cardsCount: 6, widgetId: 'metravel-r1' }),
    ).toBe(
      'https://belkraj.by/partner/widget?lat=53.9&lng=27.56&term=place&theme=cards&partner=u180793&size=6&country=BY&widgetId=metravel-r1',
    )
  })

  it('omits widgetId for the external link and country when it is unknown', () => {
    expect(buildBelkrajWidgetUrl({ coord: { lat: 52.2297, lng: 21.0122 }, cardsCount: 3 })).toBe(
      'https://belkraj.by/partner/widget?lat=52.2297&lng=21.0122&term=place&theme=cards&partner=u180793&size=3',
    )
  })

  it('pins the partner origin and the constant placement id', () => {
    expect(BELKRAJ_ORIGIN).toBe('https://belkraj.by')
    expect(BELKRAJ_PARTNER_ID).toBe('u180793')
  })
})
