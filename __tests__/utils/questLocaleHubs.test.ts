/**
 * #3217: a translated quest page must not send its visitor to a Russian page.
 * One rule decides which URL owns the interface language (detail or hub), and
 * one rule maps «Quests» navigation to the locale hub once the hubs are public.
 */
import { Platform } from 'react-native'
import {
  buildQuestLocaleHubPath, getQuestLocaleRouteParserScript, parseQuestLocaleHubRoute, parseQuestUrlLocale,
} from '@/utils/questLocaleRouting'
import { areQuestLocaleHubsPublished, localizeQuestCatalogHref } from '@/utils/questLocaleHubs'
import { normalizeBottomDockActivePath } from '@/components/layout/bottomDockItemDefs'
import { getHeaderActivePath } from '@/components/layout/customHeaderModel'
import { isTopLevelSectionPath } from '@/components/layout/topLevelSections'

describe('quest locale hubs (#3217)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS
  const originalOs = Platform.OS
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS
    else process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = originalFlag
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOs })
  })
  const publishHubs = (published: boolean) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' })
    process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = published ? 'true' : 'false'
  }

  it.each(['be', 'uk', 'pl', 'en'])('parses /%s/quests as the hub of its locale', (locale) => {
    expect(parseQuestLocaleHubRoute(`/${locale}/quests`)).toEqual({ locale, path: `/${locale}/quests` })
    expect(parseQuestLocaleHubRoute(`/${locale}/quests/?utm=1`)).toEqual({ locale, path: `/${locale}/quests` })
    expect(parseQuestUrlLocale(`/${locale}/quests`)).toBe(locale)
    expect(parseQuestUrlLocale(`/${locale}/quests/11/grodno-royal`)).toBe(locale)
    expect(buildQuestLocaleHubPath(locale as 'en')).toBe(`/${locale}/quests`)
  })

  it.each(['/ru/quests', '/xx/quests', '/quests', '/en/quests/11', '/en/map', '/en'])('keeps %s outside the URL-locale rule', (path) => {
    expect(parseQuestLocaleHubRoute(path)).toBeNull()
    expect(parseQuestUrlLocale(path)).toBeNull()
  })

  it('lets the pre-bundle head script bind the hub as it binds a detail', () => {
    const parse = new Function(`return ${getQuestLocaleRouteParserScript()}`)() as (path: string) => { locale: string } | null
    expect(parse('/pl/quests')?.locale).toBe('pl')
    expect(parse('/pl/quests/1/krakow-dragon')?.locale).toBe('pl')
    expect(parse('/quests')).toBeNull()
  })

  it('leads «Quests» to the locale hub only after the hubs are published', () => {
    publishHubs(false)
    expect(areQuestLocaleHubsPublished()).toBe(false)
    expect(localizeQuestCatalogHref('/quests', 'en')).toBe('/quests')
    publishHubs(true)
    expect(localizeQuestCatalogHref('/quests', 'en')).toBe('/en/quests')
    expect(localizeQuestCatalogHref('/quests', 'ru')).toBe('/quests')
    expect(localizeQuestCatalogHref('/map', 'en')).toBe('/map')
  })

  it('never publishes hub links in the native app', () => {
    process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = 'true'
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' })
    expect(localizeQuestCatalogHref('/quests', 'en')).toBe('/quests')
  })

  it('marks translated quest pages as the «Quests» section in dock and header', () => {
    expect(normalizeBottomDockActivePath('/en/quests')).toBe('/quests')
    expect(normalizeBottomDockActivePath('/pl/quests/1/krakow-dragon')).toBe('/quests')
    expect(getHeaderActivePath('/en/quests')).toBe('/quests')
    expect(getHeaderActivePath('/en/quests/11/grodno-royal')).toBe('/quests')
    expect(isTopLevelSectionPath('/en/quests')).toBe(true)
  })
})
