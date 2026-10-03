import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { translate as i18nT } from '@/i18n'

// #2135 / App Review 5.1.2(i): в приложении нет cookie-баннера и страницы
// «Настройки cookies», поэтому ни один юридический экран на native не отсылает к
// ним. LegalPage подменён: проверяется текст, который экран отдаёт каркасу.

let mockLegalPageProps: Record<string, unknown> | null = null

jest.mock('@/components/legal/LegalPage', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockLegalPageProps = props
    return null
  },
}))

import PrivacyScreen from '@/app/(tabs)/privacy'
import TermsScreen from '@/app/(tabs)/terms'
import CommunityRulesScreen from '@/app/(tabs)/community-rules'
import TripRulesScreen from '@/app/(tabs)/trip-rules'
import DisclaimerScreen from '@/app/(tabs)/disclaimer'

const LEGAL_SCREENS: Record<string, React.ComponentType> = {
  privacy: PrivacyScreen,
  terms: TermsScreen,
  'community-rules': CommunityRulesScreen,
  'trip-rules': TripRulesScreen,
  disclaimer: DisclaimerScreen,
}

// Отсылки к cookie-UI сайта: баннер согласия и страница настроек cookies.
const COOKIE_UI_REFERENCE = /баннер|настройк[а-яё]*\s+cookie|cookie[- ]?(?:настройк|баннер|согласи)|страниц[а-яё]*\s+«?настройки cookies/i

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

type LegalSection = { heading?: string; paragraphs: string[] }

const collectScreenText = (Screen: React.ComponentType): string[] => {
  mockLegalPageProps = null
  render(<Screen />)
  const props = mockLegalPageProps as unknown as {
    pageTitle: string
    intro?: string[]
    sections: LegalSection[]
  }
  return [
    props.pageTitle,
    ...(props.intro ?? []),
    ...props.sections.flatMap((section) => [section.heading ?? '', ...section.paragraphs]),
  ].filter(Boolean)
}

describe('legal screens on native have no cookie UI references (#2135)', () => {
  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it.each(Object.keys(LEGAL_SCREENS))('%s: no reference to the cookie banner or cookie settings page', (name) => {
    setPlatform('ios')

    const offenders = collectScreenText(LEGAL_SCREENS[name]).filter((text) => COOKIE_UI_REFERENCE.test(text))

    expect({ screen: name, offenders }).toEqual({ screen: name, offenders: [] })
  })

  it('privacy section 4 on native states that the app has no cookies or tracking', () => {
    setPlatform('ios')

    const text = collectScreenText(PrivacyScreen)

    expect(text).toContain(i18nT('legal:app.tabs.privacy.nativeAppStorage'))
    expect(text).toContain(i18nT('legal:app.tabs.privacy.nativeSiteAnalytics'))
    expect(text).not.toContain(i18nT('legal:app.tabs.privacy.analiticheskie_instrumenty_takie_kak_yandeks_03d8dc46'))
    expect(text).not.toContain(i18nT('legal:app.tabs.privacy.my_ispolzuem_tehnicheski_neobhodimye_fayly_c_86b4b204'))
    expect(i18nT('legal:app.tabs.privacy.nativeAppStorage')).toMatch(/не использует файлы cookie.*не отслеживает вас/)
  })

  it('privacy on Android uses the same native paragraphs', () => {
    setPlatform('android')

    const text = collectScreenText(PrivacyScreen)

    expect(text).toContain(i18nT('legal:app.tabs.privacy.nativeAppStorage'))
    expect(text).not.toContain(i18nT('legal:app.tabs.privacy.analiticheskie_instrumenty_takie_kak_yandeks_03d8dc46'))
  })

  it('privacy on web keeps the site text about the cookie banner and settings page', () => {
    setPlatform('web')

    const text = collectScreenText(PrivacyScreen)

    expect(text).toContain(i18nT('legal:app.tabs.privacy.my_ispolzuem_tehnicheski_neobhodimye_fayly_c_86b4b204'))
    expect(text).toContain(i18nT('legal:app.tabs.privacy.analiticheskie_instrumenty_takie_kak_yandeks_03d8dc46'))
    expect(text).not.toContain(i18nT('legal:app.tabs.privacy.nativeAppStorage'))
  })
})
