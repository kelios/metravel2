import { Platform } from 'react-native'

/**
 * Адвент-календарь путешественника (спринт 31, #2861–#2868).
 *
 * Модуль намеренно лёгкий: его читают навигационная политика
 * (`constants/platformNavRoutes.ts`) и стартовый граф меню, поэтому контент
 * дверец (`data/advent/2026.json`) сюда не импортируется — он нужен только
 * экрану и баннеру.
 */

export const ADVENT_ROUTE = '/advent'
export const ADVENT_CAMPAIGN_YEAR = 2026
/** Основных дверец — 24 (01.12–24.12); бонусные 25.12, 31.12 и 07.01 в прогресс N/24 не входят. */
export const ADVENT_MAIN_DOORS = 24

export type AdventCivilDate = { year: number; month: number; day: number }

/** Окно кампании по местному календарю клиента, обе границы включительно. */
export const ADVENT_CAMPAIGN_WINDOW: { readonly from: AdventCivilDate; readonly to: AdventCivilDate } = {
  from: { year: 2026, month: 12, day: 1 },
  to: { year: 2027, month: 1, day: 7 },
}

const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value))

/** `YYYY-MM-DD` по местному календарю клиента — без UTC-сдвига `toISOString()`. */
export const toLocalIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const civilDateToIso = ({ year, month, day }: AdventCivilDate): string =>
  `${year}-${pad2(month)}-${pad2(day)}`

/** Местная полночь календарной даты `YYYY-MM-DD` (локальная TZ клиента). */
export const isoDateToLocalMidnight = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const ADVENT_CAMPAIGN_START_ISO = civilDateToIso(ADVENT_CAMPAIGN_WINDOW.from)
export const ADVENT_CAMPAIGN_END_ISO = civilDateToIso(ADVENT_CAMPAIGN_WINDOW.to)

/**
 * DEV-переопределение «сегодня» для проверки дверец до 1 декабря:
 * `/advent?today=2026-12-03` (только web и только не-production сборка).
 * Одно на экран, баннер, карточку профиля и пункт меню — иначе проверка
 * видела бы разные даты на одной странице.
 */
export const readDevTodayOverride = (): Date | null => {
  if (process.env.NODE_ENV === 'production' || Platform.OS !== 'web' || typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('today')
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Местное «сейчас» кампании: системные часы клиента или DEV-переопределение. */
export const getAdventNow = (): Date => readDevTodayOverride() ?? new Date()

/** Кампания идёт в этот местный день: баннер, пункт меню и карточка профиля видны. */
export const isAdventCampaignWindow = (date: Date = getAdventNow()): boolean => {
  const today = toLocalIsoDate(date)
  return today >= ADVENT_CAMPAIGN_START_ISO && today <= ADVENT_CAMPAIGN_END_ISO
}
