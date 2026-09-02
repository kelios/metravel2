import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

/**
 * Фрагмент агрегата `useTravelDetailsStyles`: разное, что читают секции.
 *
 * Экраны ошибок детали путешествия сюда не входят: их пять имён (`errorContainer`,
 * `errorTitle`, `errorText`, `errorButton`, `errorButtonText`) объявляет
 * `TravelDetailsShellStyles`, откуда `TravelDetailsErrorStates` и получает
 * `styles`. До #1711 копии лежали и здесь, и не читал их никто.
 */
export const createTravelDetailsMiscStyles = (colors: ThemedColors) => ({
  mapEmptyState: {
    width: '100%',
    padding: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mapEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.textMuted,
  },
  nearSubtitle: {
    color: colors.successDark,
  },
  popularSubtitle: {
    color: colors.warningDark,
  },
  sectionBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  sectionBadgePill: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 999,
  },
  sectionBadgeNear: {
    backgroundColor: colors.successSoft,
  },
  sectionBadgePopular: {
    backgroundColor: colors.warningSoft,
  },
  sectionBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  sectionBadgeTextNear: {
    color: colors.successDark,
  },
  sectionBadgeTextPopular: {
    color: colors.warningDark,
  },

  fallback: {
    paddingVertical: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  travelListFallback: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
    justifyContent: 'center',
  },

  // 5.5: Стили для состояния загрузки (skeleton)
  loadingSkeletonWrap: {
    width: '100%' as any,
  },
  loadingSkeletonHero: {
    height: 260,
    margin: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingSkeletonContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  loadingSkeletonSpacer: {
    height: DESIGN_TOKENS.spacing.md,
  },
}) as const
