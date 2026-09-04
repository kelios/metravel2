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

  fallback: {
    paddingVertical: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
}) as const
