describe('i18n config', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
    jest.dontMock('expo-localization')
  })

  it('resolves the supported locale from Intl', () => {
    jest.doMock('expo-localization', () => ({ getLocales: () => [] }))
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: 'ru-BY' }),
        }) as Intl.DateTimeFormat,
    )

    jest.isolateModules(() => {
      const { getSystemLocale } = require('@/i18n/config')

      expect(getSystemLocale()).toBe('ru')
    })
  })

  it('does not depend on expo-localization being available', () => {
    jest.doMock('expo-localization', () => {
      throw new Error("Cannot find native module 'ExpoLocalization'")
    })
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ locale: 'ru-RU' }),
        }) as Intl.DateTimeFormat,
    )

    jest.isolateModules(() => {
      const { getSystemLocale } = require('@/i18n/config')

      expect(getSystemLocale()).toBe('ru')
    })
  })

  it('resolves every non-default locale candidate', () => {
    jest.isolateModules(() => {
      const { resolveSupportedLocale, SUPPORTED_LOCALES } = require('@/i18n/config')

      expect(SUPPORTED_LOCALES).toEqual(['ru', 'be', 'uk', 'pl', 'en'])
      expect(resolveSupportedLocale(['be-BY'])).toBe('be')
      expect(resolveSupportedLocale(['uk-UA'])).toBe('uk')
      expect(resolveSupportedLocale(['pl-PL'])).toBe('pl')
      expect(resolveSupportedLocale(['en-GB'])).toBe('en')
    })
  })

  it('uses the server-rendered document locale for the first web render', () => {
    document.documentElement.lang = 'ru-RU'
    const getLocales = jest.fn(() => [{ languageTag: 'pl-PL' }])
    jest.doMock('expo-localization', () => ({ getLocales }))

    jest.isolateModules(() => {
      const { getInitialLocale } = require('@/i18n/config')

      expect(getInitialLocale()).toBe('ru')
      expect(getLocales).not.toHaveBeenCalled()
    })
  })

  it('does not consult the machine locale during a web SSR-style render', () => {
    document.documentElement.removeAttribute('lang')
    const getLocales = jest.fn(() => [{ languageTag: 'ru-RU' }])
    jest.doMock('expo-localization', () => ({ getLocales }))

    jest.isolateModules(() => {
      const { DEFAULT_LOCALE, getInitialLocale } = require('@/i18n/config')

      expect(getInitialLocale()).toBe(DEFAULT_LOCALE)
      expect(getLocales).not.toHaveBeenCalled()
    })
  })
})
