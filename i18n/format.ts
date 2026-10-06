import i18n from './instance'
import {
  DEFAULT_LOCALE,
  getLocaleDefinition,
  isSupportedLocale,
  type SupportedLocale,
} from './config'
import { formatBelarusianDate } from './beDateFormat'
import { isIntlLocaleSupported, resolveIntlLanguageTag } from './intlSupport'
import { selectPluralCategory } from './pluralRules'
import { formatRelativeTimeFallback } from './relativeTimeFallback'

export const getActiveLocale = (): SupportedLocale =>
  isSupportedLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE

export const getActiveLocaleDefinition = () => getLocaleDefinition(getActiveLocale())

export const getFormatLocale = (locale: SupportedLocale = getActiveLocale()): string =>
  getLocaleDefinition(locale).languageTag

/**
 * Пул готовых `Intl`-форматтеров (#1643).
 *
 * Экземпляры `Intl` без состояния, поэтому переиспользуются свободно. Ключ
 * включает языковой тег, так что смена локали берёт другой форматтер, а не
 * протухший.
 *
 * Про цену — честно, чтобы следующий читатель не переоценил рычаг. Профиль
 * сначала показал здесь 30.9 мс блокировки на `/` и 32.6 мс на travel-детали,
 * но пооперационный замер (`.codex-temp/1643/`) это опроверг: почти вся сумма —
 * стоимость ПЕРВОГО `new Intl.NumberFormat` на странице (разогрев данных ICU,
 * 28.8–29.1 мс на mobile CPU ×4), а повторные конструкторы стоят ~0.1 мс. На
 * `/` их 12, на travel — один. То есть пул снимает около 1 мс на boot и НЕ
 * является рычагом TBT; он оправдан на экранах со списками, где счётчики и даты
 * форматируются десятками за проход, и как устранение заведомо лишней работы.
 */
const FORMATTER_CACHE_LIMIT = 96
const formatterCache = new Map<string, unknown>()

/**
 * Опции `Intl` — плоские объекты примитивов, поэтому стабильный ключ строится
 * по отсортированным парам. Сортировка нужна из-за spread'ов вроде
 * `{ maximumFractionDigits: 1, ...options }`: тот же набор полей может прийти в
 * разном порядке и без неё дал бы два разных ключа на один форматтер.
 */
const optionsCacheKey = (options: Record<string, unknown> | undefined): string => {
  if (!options) return ''
  const keys = Object.keys(options)
  if (keys.length === 0) return ''
  if (keys.length > 1) keys.sort()
  let key = ''
  for (const name of keys) {
    const value = options[name]
    if (value === undefined) continue
    key += `${name}=${String(value)};`
  }
  return key
}

const getCachedFormatter = <T>(
  kind: string,
  languageTag: string,
  options: Record<string, unknown> | undefined,
  create: () => T,
): T => {
  const key = `${kind}|${languageTag}|${optionsCacheKey(options)}`
  const cached = formatterCache.get(key)
  if (cached !== undefined) return cached as T
  const created = create()
  // Ключей ровно столько, сколько живых пар (локаль, опции); лимит — страховка
  // от неожиданного call site, который генерирует опции динамически.
  if (formatterCache.size >= FORMATTER_CACHE_LIMIT) formatterCache.clear()
  formatterCache.set(key, created)
  return created
}

const getDateTimeFormat = (
  options: Intl.DateTimeFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): Intl.DateTimeFormat => {
  const languageTag = resolveIntlLanguageTag('DateTimeFormat', getFormatLocale(locale))
  return getCachedFormatter(
    'datetime',
    languageTag,
    options as Record<string, unknown>,
    () => new Intl.DateTimeFormat(languageTag, options),
  )
}

// Без данных локали в движке числа идут форматом RU, не локалью хоста
// (#2283). Для BE это совпадает с CLDR `be` во всём, что печатает приложение
// (группы, десятичная запятая, компактное «тыс.», проценты); расходятся только
// символ BYN («Br» против «BYN») и длинные названия единиц — их call site'ов нет.
const getNumberFormat = (
  options: Intl.NumberFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): Intl.NumberFormat => {
  const languageTag = resolveIntlLanguageTag('NumberFormat', getFormatLocale(locale))
  return getCachedFormatter(
    'number',
    languageTag,
    options as Record<string, unknown>,
    () => new Intl.NumberFormat(languageTag, options),
  )
}

/**
 * Свои данные дат для локалей, которых нет в распространённых движках (#2283):
 * Chromium не несёт `be`, и без этого BE-дата печаталась локалью хоста.
 * Используются, только когда `Intl.DateTimeFormat` локаль не знает.
 */
const OWN_DATE_FORMATTERS: Partial<
  Record<SupportedLocale, (date: Date, options: Intl.DateTimeFormatOptions) => string | null>
> = {
  be: formatBelarusianDate,
}

export const formatDate = (
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string => {
  const date = new Date(value)
  const ownFormatter = OWN_DATE_FORMATTERS[locale]
  if (ownFormatter && !isIntlLocaleSupported('DateTimeFormat', getFormatLocale(locale))) {
    const formatted = ownFormatter(date, options)
    if (formatted !== null) return formatted
  }
  return getDateTimeFormat(options, locale).format(date)
}

export const formatDateTime = (
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string =>
  formatDate(
    value,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options,
    },
    locale,
  )

export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string => getNumberFormat(options, locale).format(value)

export const formatInteger = (
  value: number,
  locale: SupportedLocale = getActiveLocale(),
): string => {
  // RU/BE/UK/PL/EN all render ungrouped counters in [0, 1000) with the same
  // ASCII digits. This common counter path can therefore skip the
  // first Intl.NumberFormat/ICU warm-up (~29 ms in the #1643 mobile profile)
  // without moving locale policy into individual components. Keep Intl for
  // grouping, signs (including the observable `-0`), rounding and non-finite
  // values.
  if (Number.isSafeInteger(value) && value >= 0 && value < 1000 && !Object.is(value, -0)) {
    return String(value)
  }
  return formatNumber(value, { maximumFractionDigits: 0 }, locale)
}

/**
 * С какого значения счётчик печатается компактно. Ниже порога компактная форма
 * не экономит место («999» короче «0,9 тыс.»), поэтому число идёт целым.
 */
export const COMPACT_NUMBER_THRESHOLD = 1000

/**
 * Канонический компактный счётчик (#1457): единицу выбирает локаль, а не
 * хардкод — русскому пользователю «1,2 тыс.», а не английское «1.2K».
 * Новое место, где печатается компактное число, должно звать его, а не
 * собирать строку на месте.
 */
export const formatCompactNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string =>
  Math.abs(value) < COMPACT_NUMBER_THRESHOLD
    ? formatNumber(value, { maximumFractionDigits: 0, ...options }, locale)
    : formatNumber(
        value,
        { notation: 'compact', maximumFractionDigits: 1, ...options },
        locale,
      )

export const formatCurrency = (
  value: number,
  currency: string,
  locale: SupportedLocale = getActiveLocale(),
): string => formatNumber(value, { style: 'currency', currency }, locale)

/**
 * Канонический относительный формат (#1528). `Intl.RelativeTimeFormat` есть не
 * во всех движках: Hermes в Android-релизе его не содержит вовсе, поэтому
 * безусловный `new` уводил экран в error boundary. Защита живёт здесь, в самом
 * экспорте, как у `formatList` и `selectPlural` ниже, — новому коду достаточно
 * позвать эту функцию, отдельная проверка на месте вызова не нужна.
 */
export const formatRelativeTime = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  locale: SupportedLocale = getActiveLocale(),
): string => {
  const languageTag = getFormatLocale(locale)
  if (
    typeof Intl.RelativeTimeFormat === 'function' &&
    isIntlLocaleSupported('RelativeTimeFormat', languageTag)
  ) {
    return getCachedFormatter(
      'relativetime',
      languageTag,
      options as Record<string, unknown>,
      () => new Intl.RelativeTimeFormat(languageTag, options),
    ).format(value, unit)
  }
  // Нет конструктора (Hermes) или данных локали (BE в Chromium) — CLDR-таблица.
  return formatRelativeTimeFallback(value, unit, options, locale, languageTag)
}

export const formatList = (
  values: readonly string[],
  options: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' },
  locale: SupportedLocale = getActiveLocale(),
): string => {
  const languageTag = getFormatLocale(locale)
  if (typeof Intl.ListFormat === 'function' && isIntlLocaleSupported('ListFormat', languageTag)) {
    return getCachedFormatter(
      'list',
      languageTag,
      options as Record<string, unknown>,
      () => new Intl.ListFormat(languageTag, options),
    ).format(values)
  }
  // Нейтральная склейка вместо союза чужого языка (хоста или RU).
  return values.join(', ')
}

export const createCollator = (
  options: Intl.CollatorOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): Intl.Collator => {
  // Порядок RU совпадает с BE: корневая сортировка ставит «і» после «и»/перед
  // «й» и «ў» после «у», как в белорусском алфавите.
  const languageTag = resolveIntlLanguageTag('Collator', getFormatLocale(locale))
  return getCachedFormatter(
    'collator',
    languageTag,
    options as Record<string, unknown>,
    () => new Intl.Collator(languageTag, options),
  )
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}

export const selectPlural = (
  count: number,
  forms: PluralForms,
  locale: SupportedLocale = getActiveLocale(),
): string => {
  const category = selectPluralCategory(count, getFormatLocale(locale))
  return forms[category] ?? forms.other
}
