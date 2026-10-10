import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import type { QuestServingProjection } from '@/utils/questLocaleRouting'

const mockPreferenceOptions = jest.fn((_props: unknown) => null)
const mockVersionLinks = jest.fn((_props: unknown) => null)
const mockPush = jest.fn()
const mockSetLocale = jest.fn(async () => {})
let mockNavigation: unknown = null

jest.mock('@/components/layout/LanguageOptionList.tsx', () => ({
  __esModule: true, default: (props: unknown) => mockPreferenceOptions(props),
}))
jest.mock('@/components/quests/QuestVersionLinks', () => ({
  __esModule: true, default: (props: unknown) => mockVersionLinks(props),
}))
jest.mock('@/hooks/useQuestVersionNavigation', () => ({ useQuestVersionNavigation: () => mockNavigation }))
jest.mock('@/i18n/LocaleProvider', () => ({
  useLocale: () => ({ setLocale: mockSetLocale }),
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ border: '#ddd', primarySoft: '#eee', text: '#111' }) }))
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: (...args: unknown[]) => mockPush(...args) },
}))

import LanguageOptionList from '@/components/layout/LanguageOptionList.web'
const ActualVersionLinks = jest.requireActual<typeof import('@/components/quests/QuestVersionLinks')>('@/components/quests/QuestVersionLinks').default

describe('quest version language control', () => {
  beforeEach(() => { mockNavigation = null; mockPreferenceOptions.mockClear(); mockVersionLinks.mockClear() })

  it('delegates non-quest selection to the existing preference control', () => {
    const onChosen = jest.fn()
    render(<LanguageOptionList onChosen={onChosen} testIDPrefix="menu-language" />)
    expect(mockPreferenceOptions).toHaveBeenCalledWith({ onChosen, testIDPrefix: 'menu-language' })
    expect(mockVersionLinks).not.toHaveBeenCalled()
  })

  it('keeps a bound pending or unavailable page from exposing preference-only choices', () => {
    mockNavigation = { bound: true, projection: null, locale: 'pl' }
    render(<LanguageOptionList />)
    expect(mockPreferenceOptions).not.toHaveBeenCalled()
    expect(mockVersionLinks).toHaveBeenCalledWith({ projection: null, currentLocale: 'pl', onSelectLocale: mockSetLocale })
  })

  it('passes the effective served cluster and full selection callback to version links', () => {
    const projection = { state: 'available', versions: [{ locale: 'ru', path: '/quests/4/minsk-cmok' }, { locale: 'pl', path: '/pl/quests/4/minsk-cmok' }] }
    const onChosen = jest.fn()
    mockNavigation = { bound: true, projection, locale: 'pl' }
    render(<LanguageOptionList onChosen={onChosen} />)
    expect(mockVersionLinks).toHaveBeenCalledWith({ projection, currentLocale: 'pl', onChosen, onSelectLocale: mockSetLocale })
    expect(mockPreferenceOptions).not.toHaveBeenCalled()
  })
})

describe('served version anchor activation', () => {
  const originalPlatform = Platform.OS
  const projection: QuestServingProjection = {
    schema_version: 1, release_id: 'release-test', city_id: 4, quest_slug: 'minsk-cmok', locale: 'pl',
    state: 'available', canonical_path: '/pl/quests/4/minsk-cmok', ru_source_path: '/quests/4/minsk-cmok',
    versions: [{ locale: 'ru', path: '/quests/4/minsk-cmok' }, { locale: 'pl', path: '/pl/quests/4/minsk-cmok' }],
  }
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    mockPush.mockClear()
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
  })

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('preserves browser navigation for gesture %j', (gesture) => {
    const choose = jest.fn(async () => {})
    const screen = render(<ActualVersionLinks projection={projection} currentLocale="pl" onSelectLocale={choose} />)
    const preventDefault = jest.fn()
    fireEvent.press(screen.getByTestId('quest-version-ru'), { nativeEvent: gesture, preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(choose).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('navigates to the real version address even when preference persistence fails', async () => {
    const choose = jest.fn(async () => { throw new Error('storage unavailable') })
    const onChosen = jest.fn()
    const screen = render(<ActualVersionLinks projection={projection} currentLocale="pl" onSelectLocale={choose} onChosen={onChosen} />)
    const preventDefault = jest.fn()
    await act(async () => {
      fireEvent.press(screen.getByTestId('quest-version-ru'), { nativeEvent: {}, preventDefault })
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith('ru')
    expect(onChosen).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/quests/4/minsk-cmok')
  })
})
