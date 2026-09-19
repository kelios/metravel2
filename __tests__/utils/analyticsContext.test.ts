import { readConsent } from '@/utils/consent'
import { classifyDevice, classifyTrafficSource } from '@/utils/analyticsContext'

jest.mock('@/utils/consent', () => ({ readConsent: jest.fn() }))

const mockedConsent = readConsent as jest.MockedFunction<typeof readConsent>

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

describe('classifyDevice', () => {
  it('различает телефон, планшет и десктоп по UA', () => {
    expect(classifyDevice({ userAgent: IPHONE, viewportWidth: 390 })).toBe('mobile')
    expect(classifyDevice({ userAgent: ANDROID_PHONE, viewportWidth: 412 })).toBe('mobile')
    expect(classifyDevice({ userAgent: IPAD, viewportWidth: 1024 })).toBe('tablet')
    // Планшетный Chrome отдаёт Android-UA без токена `Mobile`.
    expect(classifyDevice({ userAgent: ANDROID_TABLET, viewportWidth: 1280 })).toBe('tablet')
    expect(classifyDevice({ userAgent: DESKTOP, viewportWidth: 1680 })).toBe('desktop')
  })

  it('в нативном приложении берёт ширину экрана, а не UA браузера', () => {
    expect(classifyDevice({ platformOs: 'ios', viewportWidth: 390 })).toBe('mobile')
    expect(classifyDevice({ platformOs: 'ios', viewportWidth: 1024 })).toBe('tablet')
    expect(classifyDevice({ platformOs: 'android', viewportWidth: 412 })).toBe('mobile')
  })

  it('пустой UA не превращает десктоп в телефон', () => {
    expect(classifyDevice({})).toBe('desktop')
  })
})

describe('classifyTrafficSource', () => {
  const currentHost = 'metravel.by'

  it('без реферера это прямой заход', () => {
    expect(classifyTrafficSource({ currentHost })).toBe('direct')
    expect(classifyTrafficSource({ referrer: '', currentHost })).toBe('direct')
  })

  it('свой же хост — внутренний переход', () => {
    expect(classifyTrafficSource({ referrer: 'https://metravel.by/quests', currentHost })).toBe('internal')
  })

  it('разводит поисковики', () => {
    expect(classifyTrafficSource({ referrer: 'https://www.google.com/', currentHost })).toBe('google')
    expect(classifyTrafficSource({ referrer: 'https://google.by/search?q=квест', currentHost })).toBe('google')
    expect(classifyTrafficSource({ referrer: 'https://yandex.by/search/', currentHost })).toBe('yandex')
    expect(classifyTrafficSource({ referrer: 'https://duckduckgo.com/', currentHost })).toBe('search')
    // Хост поиска Mail.ru кончается на `mail.ru`, и без терминирующей точки этот
    // шаблон не срабатывал вовсе — переход уезжал в `referral`.
    expect(classifyTrafficSource({ referrer: 'https://go.mail.ru/search', currentHost })).toBe('search')
  })

  it('узнаёт соцсети и прочие сайты', () => {
    expect(classifyTrafficSource({ referrer: 'https://m.facebook.com/', currentHost })).toBe('social')
    expect(classifyTrafficSource({ referrer: 'https://vk.com/feed', currentHost })).toBe('social')
    expect(classifyTrafficSource({ referrer: 'https://example.org/blog', currentHost })).toBe('referral')
  })

  it('utm_source важнее реферера', () => {
    expect(
      classifyTrafficSource({ referrer: 'https://metravel.by/', utmSource: 'google', currentHost }),
    ).toBe('google')
    expect(classifyTrafficSource({ utmSource: 'newsletter', currentHost })).toBe('campaign')
  })
})

describe('идентификаторы и источник визита', () => {
  // Хранилища и UA существуют только на web; на native аналитика выключена
  // целиком (`sendAnalyticsEvent` выходит сразу). Expo-пресет успевает
  // закешировать `react-native` до hoisted-мока, поэтому платформа
  // подменяется через `doMock` + `require` — так же, как в `analytics.test.ts`.
  const loadWebContext = () => {
    jest.resetModules()
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }))
    jest.doMock('@/utils/consent', () => ({ readConsent: mockedConsent }))
    return require('@/utils/analyticsContext')
  }

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    mockedConsent.mockReturnValue({ necessary: true, analytics: true, date: '2026-09-19' })
  })

  afterEach(() => {
    jest.dontMock('react-native')
    jest.dontMock('@/utils/consent')
  })

  it('не заводит долгоживущих меток без согласия на аналитику', () => {
    mockedConsent.mockReturnValue({ necessary: true, analytics: false, date: '2026-09-19' })
    const ctx = loadWebContext()

    expect(ctx.getAnalyticsClientId()).toBeUndefined()
    expect(ctx.getAnalyticsSessionId()).toBeUndefined()
    expect(ctx.getAnalyticsTrafficSource()).toBeUndefined()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('держит client_id между визитами, а session_id — в пределах вкладки', () => {
    const ctx = loadWebContext()
    const clientId = ctx.getAnalyticsClientId()
    const sessionId = ctx.getAnalyticsSessionId()

    expect(clientId).toBeTruthy()
    expect(ctx.getAnalyticsClientId()).toBe(clientId)
    expect(ctx.getAnalyticsSessionId()).toBe(sessionId)

    // Новая вкладка: sessionStorage пуст, localStorage — нет.
    window.sessionStorage.clear()
    expect(ctx.getAnalyticsClientId()).toBe(clientId)
    expect(ctx.getAnalyticsSessionId()).not.toBe(sessionId)
  })

  it('фиксирует источник один раз за сессию и дальше его не пересчитывает', () => {
    const ctx = loadWebContext()
    const first = ctx.getAnalyticsTrafficSource()
    expect(first).toBe('direct')

    // К пятой точке квеста реферер давно другой — источник визита не меняется.
    Object.defineProperty(window.document, 'referrer', {
      value: 'https://www.google.com/',
      configurable: true,
    })
    expect(ctx.getAnalyticsTrafficSource()).toBe(first)
  })

  it('отзыв согласия стирает уже заведённые метки, а не только глушит отправку', () => {
    const ctx = loadWebContext()
    expect(ctx.getAnalyticsClientId()).toBeTruthy()
    expect(ctx.getAnalyticsSessionId()).toBeTruthy()
    expect(ctx.getAnalyticsTrafficSource()).toBeTruthy()

    ctx.clearAnalyticsIdentity()

    expect(window.localStorage.getItem('metravel_analytics_cid_v1')).toBeNull()
    expect(window.sessionStorage.getItem('metravel_analytics_sid_v1')).toBeNull()
    expect(window.sessionStorage.getItem('metravel_analytics_src_v1')).toBeNull()
  })

  it('на native измерения устройства остаются, а меток браузера нет', () => {
    jest.resetModules()
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }))
    jest.doMock('@/utils/consent', () => ({ readConsent: mockedConsent }))
    const ctx = require('@/utils/analyticsContext')

    expect(ctx.getAnalyticsClientId()).toBeUndefined()
    expect(ctx.getAnalyticsContext()).toMatchObject({ platform: 'ios', auth_state: 'guest' })
  })
})
