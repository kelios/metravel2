import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { CONTROL_RADIUS, type FiltersPanelStyleContext } from './context'

export const getMapControlsStyles = ({ colors }: FiltersPanelStyleContext) =>
  ({
    mapControlsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 6,
      alignItems: 'center',
      marginTop: 6,
    },
    mapLayersSection: {
      marginTop: 8,
    },
    mapLayersLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    mapLayersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    mapToggleList: {
      gap: 5,
      marginTop: 5,
    },
    mapOverlaySection: {
      marginTop: 10,
    },
    mapOverlaySectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    mapToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    mapToggleRowPressed: {
      backgroundColor: colors.surfaceMuted ?? colors.backgroundSecondary,
    },
    mapToggleRowDisabled: {
      opacity: 0.5,
    },
    mapToggleText: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    mapLayerChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlpha40,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          } as any)
        : null),
    },
    mapLayerChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
          } as any)
        : null),
    },
  }) as const
