/**
 * @jest-environment jsdom
 */
import fs from 'node:fs'
import path from 'node:path'

import { render } from '@testing-library/react-native'
import type { ComponentType } from 'react'
import { Platform, Text } from 'react-native'

import { resources } from '@/i18n/resources'
import { writeConsent } from '@/utils/consent'

// #2135: на мобильном web текст баннера ограничен `numberOfLines={2}` (решение
// дизайна: баннер компактный). На ширине 320 бокс текста — 262 px (320 − 2×16
// отступы обёртки − 2×1 рамка − 2×12 паддинг), шрифт 11 px / 500. Прежний текст
// в 80 символов занимал на 320 три строки в RU/BE/PL, и многоточие съедало конец
// утверждения («…третьим лицам для …»). Лечится длиной строки во всех пяти
// локалях, а не подъёмом `numberOfLines`.
const MAX_BANNER_TEXT_LENGTH = 65
const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const

type NavigationBundle = Record<string, string>

const navigationOf = (locale: (typeof LOCALES)[number]): NavigationBundle =>
  resources[locale].navigation as NavigationBundle

// Ключ читается из самого компонента: тест следует за сменой ключа и не даёт
// подставить в компактный баннер длинную строку мимо порога.
const readBannerTextKey = (): string => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/layout/ConsentBanner.tsx'),
    'utf8',
  )
  const match = source.match(
    /numberOfLines=\{isMobile \? 2 : undefined\}[\s\S]*?i18nT\('navigation:([^']+)'\)/,
  )
  if (!match) {
    throw new Error('ConsentBanner: не найден текст с numberOfLines={isMobile ? 2 : undefined}')
  }
  return match[1]
}

jest.mock('expo-router', () => ({
  __esModule: true,
  usePathname: () => '/',
  Link: ({ children }: { children: unknown }) => children,
}))

jest.mock('@/hooks/useResponsive', () => ({
  __esModule: true,
  useResponsive: () => ({ isMobile: true, width: 320 }),
}))

jest.mock('@/components/layout/bottomChromeInset', () => ({
  ...jest.requireActual('@/components/layout/bottomChromeInset'),
  __esModule: true,
  useDockReservePx: () => 0,
}))

jest.mock('@/hooks/useFooterOverlayOpen', () => ({
  __esModule: true,
  useFooterOverlayOpen: () => false,
}))

jest.mock('@/utils/consent', () => ({
  __esModule: true,
  readConsent: () => null,
  writeConsent: jest.fn(),
}))

describe('ConsentBanner text (#2135)', () => {
  const bannerTextKey = readBannerTextKey()

  it.each(LOCALES)('fits the compact two-line banner at 320 px (%s)', (locale) => {
    const value = navigationOf(locale)[bannerTextKey]

    expect(typeof value).toBe('string')
    expect(value.trim()).not.toBe('')
    expect({ locale, value, fits: value.length <= MAX_BANNER_TEXT_LENGTH }).toEqual({
      locale,
      value,
      fits: true,
    })
  })

  it('translates the banner text in every non-default locale', () => {
    const ru = navigationOf('ru')[bannerTextKey]
    for (const locale of LOCALES.filter((item) => item !== 'ru')) {
      expect({ locale, sameAsRu: navigationOf(locale)[bannerTextKey] === ru }).toEqual({
        locale,
        sameAsRu: false,
      })
    }
  })

  describe('mobile web render', () => {
    const originalPlatform = Platform.OS

    afterEach(() => {
      Platform.OS = originalPlatform
    })

    it('renders the short text under the two-line clamp at 320 px', () => {
      // `isWeb` в компоненте вычисляется при загрузке модуля: модуль грузится
      // здесь, уже под web, а не статическим импортом наверху файла.
      Platform.OS = 'web'
      const ConsentBanner: ComponentType = require('@/components/layout/ConsentBanner').default

      const screen = render(<ConsentBanner />)
      const expected = navigationOf('ru')[bannerTextKey]
      const textNode = screen
        .UNSAFE_getAllByType(Text)
        .find((node) => node.props.children === expected)

      expect(screen.getByTestId('consent-banner')).toBeTruthy()
      expect(textNode).toBeDefined()
      expect(textNode?.props.numberOfLines).toBe(2)
    })
  })
})

// #2162: e2e закрывают баннер только по testID (`e2e/helpers/consentBanner.ts`),
// поэтому testID кнопок — контракт, а не деталь вёрстки.
describe('ConsentBanner choice buttons are addressable by testID (#2162)', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    Platform.OS = originalPlatform
    ;(writeConsent as jest.Mock).mockClear()
  })

  it.each([
    ['consent-accept', true],
    ['consent-decline', false],
  ] as const)('%s saves the matching consent', (testID, analytics) => {
    Platform.OS = 'web'
    const ConsentBanner: ComponentType = require('@/components/layout/ConsentBanner').default
    const screen = render(<ConsentBanner />)

    // Обёртка баннера несёт `pointerEvents: 'none'` (CSS-семантика web: клики
    // проходят к кнопкам с `auto`), а RNTL по RN-семантике гасит такой press —
    // поэтому связку testID → обработчик проверяем через сам компонент кнопки.
    screen.UNSAFE_getByProps({ testID }).props.onPress()

    expect(writeConsent).toHaveBeenCalledWith(expect.objectContaining({ necessary: true, analytics }))
  })
})
