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
  webDeferredSection: Platform.select({
    web: {
      // The shared visibility gate already defers these sections. Once mounted,
      // their measured flow height must not switch from an intrinsic guess.
      contentVisibility: 'visible',
      contain: 'layout style paint',
      containIntrinsicSize: 'none',
    } as any,
    default: {},
  }),
  // Optional sections use the same real geometry, including an empty result.
  webOptionalDeferredSection: Platform.select({
    web: {
      contentVisibility: 'visible',
      contain: 'layout style paint',
      containIntrinsicSize: 'none',
    } as any,
    default: {},
  }),
  ...TRAVEL_DETAILS_SECTION_RHYTHM,
}) as const
