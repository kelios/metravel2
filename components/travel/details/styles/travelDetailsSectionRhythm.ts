import { DESIGN_TOKENS } from '@/constants/designSystem'

import { COMPACT_SPACING } from '../TravelDetailsStyleFragments'

/**
 * Вертикальный ритм секций детали путешествия.
 *
 * Ключи не зависят от темы, но нужны обоим наборам стилей страницы — общему
 * (`createTravelDetailsLayoutStyles` → `useTravelDetailsStyles`) и hero-набору
 * (`getTravelDetailsHeroStyles` → `useTravelDetailsHeroStyles`). Пока каждый
 * набор объявлял их сам, `sectionContainer` разошёлся: hero давал на web 40px,
 * общий — 32px, и отступ секции зависел от того, каким хуком отрисован блок
 * (#1704). Одно имя — одно определение, поэтому оно живёт здесь, а наборы его
 * раскладывают спредом.
 */
export const TRAVEL_DETAILS_SECTION_RHYTHM = {
  sectionContainer: {
    // 32px и на web, и на native: плотный desktop-ритм по UI-review #7.
    marginBottom: COMPACT_SPACING.section.desktop + 8,
    width: '100%',
  },

  contentStable: {
    // Предотвращает layout shift при загрузке контента
    minHeight: DESIGN_TOKENS.spacing.xxl,
  },

  quickFactsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
} as const
