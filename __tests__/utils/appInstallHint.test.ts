import {
  DISMISS_COOLDOWN_MS,
  MAX_DISMISSALS,
  isAndroidPhoneUserAgent,
  shouldOfferAppInstall,
  type AppInstallHintContext,
} from '@/utils/appInstallHint'

const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const NOW = 1_700_000_000_000

const context = (overrides: Partial<AppInstallHintContext> = {}): AppInstallHintContext => ({
  userAgent: ANDROID_PHONE_UA,
  isMobileViewport: true,
  referrer: '',
  isStandalone: false,
  state: null,
  now: NOW,
  ...overrides,
})

describe('isAndroidPhoneUserAgent', () => {
  it('распознаёт Android-телефон', () => {
    expect(isAndroidPhoneUserAgent(ANDROID_PHONE_UA)).toBe(true)
  })

  it('не считает телефоном планшет, iPhone и десктоп', () => {
    expect(isAndroidPhoneUserAgent(ANDROID_TABLET_UA)).toBe(false)
    expect(isAndroidPhoneUserAgent(IPHONE_UA)).toBe(false)
    expect(isAndroidPhoneUserAgent(DESKTOP_UA)).toBe(false)
    expect(isAndroidPhoneUserAgent('')).toBe(false)
  })
})

describe('shouldOfferAppInstall', () => {
  it('предлагает установку новому посетителю с Android-телефона', () => {
    expect(shouldOfferAppInstall(context())).toBe(true)
  })

  it('молчит на неподходящих поверхностях', () => {
    expect(shouldOfferAppInstall(context({ userAgent: IPHONE_UA }))).toBe(false)
    expect(shouldOfferAppInstall(context({ isMobileViewport: false }))).toBe(false)
    expect(shouldOfferAppInstall(context({ isStandalone: true }))).toBe(false)
  })

  it('молчит, если человек пришёл из установленного приложения', () => {
    expect(
      shouldOfferAppInstall(context({ referrer: 'android-app://by.metravel.app/' }))
    ).toBe(false)
  })

  it('никогда не возвращается после перехода в Google Play', () => {
    expect(
      shouldOfferAppInstall(
        context({ state: { installClickedAt: NOW - 5 * DISMISS_COOLDOWN_MS }, now: NOW })
      )
    ).toBe(false)
  })

  it('держит паузу после закрытия и возвращается по её истечении', () => {
    const state = { dismissedAt: NOW, dismissCount: 1 }
    expect(shouldOfferAppInstall(context({ state, now: NOW + DISMISS_COOLDOWN_MS - 1 }))).toBe(
      false
    )
    expect(shouldOfferAppInstall(context({ state, now: NOW + DISMISS_COOLDOWN_MS + 1 }))).toBe(true)
  })

  it('перестаёт показываться после лимита закрытий', () => {
    const state = { dismissedAt: NOW, dismissCount: MAX_DISMISSALS }
    expect(shouldOfferAppInstall(context({ state, now: NOW + 10 * DISMISS_COOLDOWN_MS }))).toBe(
      false
    )
  })
})
