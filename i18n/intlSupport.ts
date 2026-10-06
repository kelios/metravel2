import { FALLBACK_LOCALE, getLocaleDefinition } from './config'

/**
 * Явное определение, есть ли у движка данные локали для семейства `Intl` (#2283).
 *
 * `new Intl.DateTimeFormat('be-BY')` не бросает, когда данных `be` нет, а молча
 * берёт локаль хоста: в Chromium 149 (Playwright, headless) белорусская дата
 * печаталась «Sep 12» при английской системе и «12 сент.» при русской. Замер
 * 06.10.2026: Chromium 149 знает `be` только в `PluralRules`; `DateTimeFormat`,
 * `NumberFormat`, `RelativeTimeFormat`, `ListFormat` и `Collator` его не
 * знают. Node 22 (full ICU 76.1, CLDR 46) знает `be` во всех семействах.
 * Hermes на Android/iPhone не измерялся: конструкторы, которые в нём есть,
 * проходят ту же проверку, а без `supportedLocalesOf` движку верим на слово.
 *
 * Поэтому канонический слой спрашивает поддержку до конструктора и при её
 * отсутствии берёт осознанный фолбэк — формат RU (`FALLBACK_LOCALE`), а не язык
 * системы. Где RU для локали не годится (BE-даты), у слоя свои данные.
 */
export type IntlLocaleFamily =
  | 'Collator'
  | 'DateTimeFormat'
  | 'ListFormat'
  | 'NumberFormat'
  | 'PluralRules'
  | 'RelativeTimeFormat'

type LocaleAwareConstructor = ((...args: never[]) => unknown) & {
  supportedLocalesOf?: (locales: string | readonly string[]) => string[]
}

const supportCache = new Map<string, boolean>()

export const isIntlLocaleSupported = (
  family: IntlLocaleFamily,
  languageTag: string,
): boolean => {
  const constructor = (Intl as unknown as Record<string, LocaleAwareConstructor | undefined>)[
    family
  ]
  if (typeof constructor !== 'function') return false
  const key = `${family}|${languageTag}`
  const cached = supportCache.get(key)
  if (cached !== undefined) return cached
  let supported = true
  if (typeof constructor.supportedLocalesOf === 'function') {
    try {
      supported = constructor.supportedLocalesOf([languageTag]).length > 0
    } catch {
      supported = false
    }
  }
  supportCache.set(key, supported)
  return supported
}

/**
 * Языковой тег, который реально получит конструктор: тег локали, если движок
 * его знает, иначе тег RU. Хост-локаль не используется никогда.
 */
export const resolveIntlLanguageTag = (
  family: IntlLocaleFamily,
  languageTag: string,
): string =>
  isIntlLocaleSupported(family, languageTag)
    ? languageTag
    : getLocaleDefinition(FALLBACK_LOCALE).languageTag
