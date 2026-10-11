import type Feather from '@expo/vector-icons/Feather'
import {
  seasonalCalendarCore,
  type SeasonalCalendarDefinition,
  type SeasonalCalendarResult,
  type SeasonalCalendarPeriod,
} from '@/utils/seasonalCalendarCore'
export type { SeasonalCalendarRule, SeasonalCivilDate, SeasonalMonthDay } from '@/utils/seasonalCalendarCore'
import type { SeasonalMonthDay } from '@/utils/seasonalCalendarCore'

/**
 * Реестр сезонного (праздничного) оформления сайта (#2376).
 *
 * Одна запись = одна тема. Визуал темы живёт в `app/global.css` блоками
 * `html[data-season="<id>"]` (светлая) и `html[data-season="<id>"][data-theme="dark"]`
 * (тёмная): на web каждый токен дизайн-системы — живая CSS-переменная
 * `var(--color-<name>, fallback)` (`constants/designSystem.ts`), поэтому сезон
 * переопределяет только переменные и не трогает компоненты.
 *
 * Как добавить тему: запись сюда → CSS-блоки в `app/global.css` → ключи
 * `seasonalTheme.option.<id>` и `seasonalTheme.option.<id>.description` в
 * `i18n/locales/<locale>/static/navigation_static.ts` всех локалей →
 * `docs/features/seasonal-theme.md`. Переключатель, хранение, стартовый скрипт
 * и тесты реестр читают сами.
 */

export type SeasonalThemeId = 'spring' | 'easter' | 'autumn' | 'halloween' | 'christmas'

/** `auto` — по календарному окну, `off` — обычный вид, иначе конкретная тема. */
export type SeasonalThemePreference = 'auto' | 'off' | SeasonalThemeId

/** Окно включения; `to` раньше `from` означает переход через Новый год. */
export interface SeasonalWindow {
  from: SeasonalMonthDay
  to: SeasonalMonthDay
}

export interface SeasonalThemeDefinition extends SeasonalCalendarDefinition {
  id: SeasonalThemeId
  /** Иконка `Feather` для переключателя. */
  icon: keyof typeof Feather.glyphMap
}

export interface SeasonalThemePeriod extends SeasonalCalendarPeriod {
  id: SeasonalThemeId
}

export interface SeasonalThemeCalendar extends SeasonalCalendarResult {
  activeId: SeasonalThemeId | null
  windows: SeasonalThemePeriod[]
  currentPeriod: SeasonalThemePeriod | null
  nextPeriod: SeasonalThemePeriod | null
}

export const SEASONAL_THEME_STORAGE_KEY = 'seasonal-theme'
export const SEASONAL_THEME_DOM_ATTRIBUTE = 'data-season'

export const SEASONAL_THEMES: readonly SeasonalThemeDefinition[] = [
  {
    id: 'spring',
    icon: 'sun',
    priority: 10,
    rules: [{ kind: 'fixedAnnual', from: { month: 3, day: 1 }, to: { month: 3, day: 10 } }],
  },
  {
    id: 'easter',
    icon: 'gift',
    priority: 30,
    rules: [
      { kind: 'easterRelative', calendar: 'western', fromOffset: -7, toOffset: 2 },
      { kind: 'easterRelative', calendar: 'orthodox', fromOffset: -7, toOffset: 2 },
    ],
  },
  {
    id: 'autumn',
    icon: 'feather',
    priority: 10,
    rules: [{ kind: 'fixedAnnual', from: { month: 9, day: 15 }, to: { month: 10, day: 14 } }],
  },
  {
    id: 'halloween',
    icon: 'moon',
    priority: 20,
    rules: [{ kind: 'fixedAnnual', from: { month: 10, day: 15 }, to: { month: 11, day: 1 } }],
  },
  {
    id: 'christmas',
    icon: 'star',
    priority: 20,
    rules: [{ kind: 'fixedAnnual', from: { month: 12, day: 1 }, to: { month: 1, day: 14 } }],
  },
]

export const SEASONAL_THEME_IDS: readonly SeasonalThemeId[] = SEASONAL_THEMES.map((t) => t.id)

export const isSeasonalThemeId = (value: unknown): value is SeasonalThemeId =>
  typeof value === 'string' && (SEASONAL_THEME_IDS as readonly string[]).includes(value)

export const isSeasonalThemePreference = (value: unknown): value is SeasonalThemePreference =>
  value === 'auto' || value === 'off' || isSeasonalThemeId(value)

const toDayOfYearKey = ({ month, day }: SeasonalMonthDay): number => month * 100 + day

/** Включает обе границы; окно с `to < from` оборачивается через конец года. */
export const isMonthDayInWindow = (point: SeasonalMonthDay, window: SeasonalWindow): boolean => {
  const p = toDayOfYearKey(point)
  const from = toDayOfYearKey(window.from)
  const to = toDayOfYearKey(window.to)
  return from <= to ? p >= from && p <= to : p >= from || p <= to
}

export const getSeasonalThemeByCalendar = (date: Date = new Date()): SeasonalThemeId | null => {
  return getSeasonalCalendar(date).activeId
}

/** Priority-resolved, merged periods use the visitor's local civil date. */
export const getSeasonalCalendar = (date: Date = new Date()): SeasonalThemeCalendar =>
  seasonalCalendarCore(SEASONAL_THEMES, {
    year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
  }) as SeasonalThemeCalendar

/** Verify annual conflicts across the supported regression horizon. */
export const validateSeasonalRegistry = (registry: readonly SeasonalCalendarDefinition[] = SEASONAL_THEMES): void => {
  for (let year = 2000; year <= 2100; year++) {
    seasonalCalendarCore(registry, { year, month: 1, day: 1 })
  }
}

export const resolveSeasonalTheme = (
  preference: SeasonalThemePreference,
  date: Date = new Date(),
): SeasonalThemeId | null => {
  if (preference === 'off') return null
  if (preference === 'auto') return getSeasonalThemeByCalendar(date)
  return isSeasonalThemeId(preference) ? preference : getSeasonalThemeByCalendar(date)
}
