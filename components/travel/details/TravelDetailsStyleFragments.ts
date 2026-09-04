

/**
 * Константы наборов стилей детали путешествия объявляются ТОЛЬКО здесь.
 *
 * Смещение шапки читает `TravelDetailsShellStyles` (боковое меню на web) и
 * через него `useTravelDetailsLayout`; журнальный шрифт — тот же shell-набор и
 * `components/travel/CTASection`. До #1712 каждый из них объявлял свою копию:
 * значения совпадали, поэтому правка одной копии не меняла экран целиком и
 * искать причину пришлось бы не там. Инвариант держит гейт
 * `travelDetailsStyleKeyOwnership` — он сверяет не только ключи объектов
 * стилей, но и объявления констант в модулях наборов.
 */
export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56
export const JOURNAL_FONT_FAMILY =
  "'Georgia', 'Times New Roman', 'Inter', serif"

export const COMPACT_SPACING = {
  hero: {
    mobile: 14,
    desktop: 28,
  },
  section: {
    mobile: 12,
    desktop: 24,
  },
  card: {
    mobile: 10,
    desktop: 16,
  },
  margin: {
    section: 14,
    card: 8,
  },
} as const

export const COMPACT_TYPOGRAPHY = {
  title: {
    mobile: 22,
    desktop: 24,
  },
  subtitle: {
    mobile: 17,
    desktop: 19,
  },
  body: {
    mobile: 14,
    desktop: 15,
  },
  caption: {
    mobile: 12,
    desktop: 13,
  },
} as const

export const FLUID_TYPOGRAPHY = {
  hero: {
    minSize: 24,
    maxSize: 32,
  },
  h1: {
    minSize: 22,
    maxSize: 24,
  },
  h2: {
    minSize: 18,
    maxSize: 20,
  },
  body: {
    minSize: 14,
    maxSize: 16,
  },
} as const
