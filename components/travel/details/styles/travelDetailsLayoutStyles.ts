import { Platform } from 'react-native'

import { type ThemedColors } from '@/hooks/useTheme'

import { TRAVEL_DETAILS_SECTION_RHYTHM } from './travelDetailsSectionRhythm'

/**
 * Фрагмент агрегата `useTravelDetailsStyles`: только то, что читают секции.
 *
 * Оболочку страницы — обёртку, safe area, боковое меню, скролл и контентные
 * контейнеры — этот фрагмент не описывает: их владелец `TravelDetailsShellStyles`,
 * и до #1711 те же тринадцать имён лежали здесь второй копией, которую не читал
 * никто (`sideMenuBase` и `scrollContent` уже успели разойтись по значению).
 * Инвариант держит гейт `travelDetailsStyleKeyOwnership`.
 *
 * `_colors` остаётся в сигнатуре: агрегат зовёт все фрагменты одинаково.
 */
export const createTravelDetailsLayoutStyles = (_colors: ThemedColors) => ({
  lazySectionReserved: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
  },
  webDeferredSection: Platform.select({
    web: {
      // Defer render/paint for below-the-fold sections without CLS.
      contentVisibility: 'auto',
      contain: 'layout style paint',
      containIntrinsicSize: '720px 480px',
    } as any,
    default: {},
  }),
  // Optional sections (excursions/quests widgets) may resolve to empty. Reserve a
  // much smaller intrinsic size so an empty result does not leave a tall blank box
  // and trigger CLS once the real (small or zero) height is known.
  webOptionalDeferredSection: Platform.select({
    web: {
      contentVisibility: 'auto',
      contain: 'layout style paint',
      containIntrinsicSize: '720px 160px',
    } as any,
    default: {},
  }),
  ...TRAVEL_DETAILS_SECTION_RHYTHM,
}) as const
