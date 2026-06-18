import { Platform, StyleSheet } from 'react-native'
import {
  CONTROL_RADIUS,
  PILL_RADIUS,
  type FiltersPanelStyleContext,
} from './context'

export const getChipsStyles = ({ colors, isMobile }: FiltersPanelStyleContext) =>
  ({
    separator: {
      width: 1,
      backgroundColor: colors.border,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 8,
      letterSpacing: 0,
      textTransform: 'uppercase' as const,
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
      marginTop: -2,
      lineHeight: 16,
    },
    chipsContainer: {
      marginTop: 2,
    },
    chipsContent: {
      alignItems: 'center',
      paddingRight: 2,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 32,
      borderRadius: PILL_RADIUS,
      maxWidth: isMobile ? 180 : '100%',
      marginRight: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            cursor: 'pointer',
          } as any)
        : null),
    },
    categoryChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.light,
          } as any)
        : null),
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
      minWidth: 0,
      marginRight: 4,
    },
    categoryChipTextSelected: {
      color: colors.primaryText,
      fontWeight: '700',
    },
    categoryChipIconButton: {
      width: 24,
      height: 24,
      borderRadius: CONTROL_RADIUS,
      marginHorizontal: 0,
      backgroundColor: 'transparent',
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    moreChip: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: PILL_RADIUS,
    },
    moreChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
    },
    mobileFiltersQuickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: isMobile ? 2 : 10,
    },
    mobileFiltersQuickChips: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      minWidth: 0,
    },
    mobileFiltersQuickChip: {
      maxWidth: '100%',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mobileFiltersQuickChipText: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '700',
      color: colors.text,
    },
    mobileFiltersQuickButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      flexShrink: 0,
    },
    radiusOptionsScroll: {
      marginTop: 2,
      marginHorizontal: 0,
    },
    radiusOptionsScrollContent: {
      paddingHorizontal: 0,
    },
    radiusSegmentTrack: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: 4,
      padding: 3,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    radiusSegment: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 56,
      minHeight: 36,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            transition: 'background-color 0.18s ease',
            cursor: 'pointer',
          } as any)
        : null),
    },
    radiusSegmentSelected: {
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.light,
          } as any)
        : null),
    },
    radiusSegmentPressed: {
      opacity: 0.85,
    },
    radiusSegmentText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    radiusSegmentTextSelected: {
      color: colors.textOnPrimary,
      fontWeight: '800',
    },
    radiusSelectionHint: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    filterSelectionSummary: {
      marginTop: 8,
      padding: isMobile ? 8 : 9,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      gap: isMobile ? 6 : 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filterSelectionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    filterSelectionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    filterSelectionChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.light,
          } as any)
        : null),
    },
    filterSelectionChipText: {
      maxWidth: 180,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
  }) as const
