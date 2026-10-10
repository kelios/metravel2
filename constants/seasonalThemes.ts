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

export type SeasonalThemeId = 'halloween' | 'christmas'

/** `auto` — по календарному окну, `off` — обычный вид, иначе конкретная тема. */
export type SeasonalThemePreference = 'auto' | 'off' | SeasonalThemeId

/** Месяц 1–12 и день месяца; год не участвует — окно повторяется ежегодно. */
export interface SeasonalMonthDay {
  month: number
  day: number
}

/** Окно включения; `to` раньше `from` означает переход через Новый год. */
export interface SeasonalWindow {
  from: SeasonalMonthDay
  to: SeasonalMonthDay
}

export interface SeasonalThemeDefinition {
  id: SeasonalThemeId
  /** Иконка `MaterialCommunityIcons` для переключателя. */
  icon: string
  window: SeasonalWindow
}

export const SEASONAL_THEME_STORAGE_KEY = 'seasonal-theme'
export const SEASONAL_THEME_DOM_ATTRIBUTE = 'data-season'

export const SEASONAL_THEMES: readonly SeasonalThemeDefinition[] = [
  {
    id: 'halloween',
    icon: 'halloween',
    window: { from: { month: 10, day: 15 }, to: { month: 11, day: 1 } },
  },
  {
    id: 'christmas',
    icon: 'snowflake',
    window: { from: { month: 12, day: 1 }, to: { month: 1, day: 14 } },
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
  const point = { month: date.getMonth() + 1, day: date.getDate() }
  const match = SEASONAL_THEMES.find((theme) => isMonthDayInWindow(point, theme.window))
  return match ? match.id : null
}

export const resolveSeasonalTheme = (
  preference: SeasonalThemePreference,
  date: Date = new Date(),
): SeasonalThemeId | null => {
  if (preference === 'off') return null
  if (preference === 'auto') return getSeasonalThemeByCalendar(date)
  return preference
}
