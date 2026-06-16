import { Platform, StyleSheet } from 'react-native'
import {
  CARD_RADIUS,
  PILL_RADIUS,
  TS,
  TOUCH,
  type FiltersPanelStyleContext,
} from './context'

export const getStatusStyles = ({ colors, isMobile, bottomDockReserve }: FiltersPanelStyleContext) =>
  ({
    contentContainer: {
      paddingBottom: isMobile ? 10 : 24 + bottomDockReserve,
      paddingTop: isMobile ? 4 : 2,
      paddingHorizontal: isMobile ? 8 : 4,
      flexGrow: 1,
    },
    filtersStatusCard: {
      padding: isMobile ? 14 : 14,
      borderRadius: CARD_RADIUS,
      marginBottom: isMobile ? 10 : 12,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      gap: isMobile ? 6 : 8,
    },
    filtersStatusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    filtersStatusTitle: {
      flex: 1,
      minWidth: 0,
      ...TS.h3,
      color: colors.primaryText,
    },
    filtersStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filtersStatusBadgeText: {
      ...TS.label,
      color: colors.text,
    },
    filtersStatusDescription: {
      ...TS.bodySmall,
      color: colors.text,
    },
    mobileFiltersContextCard: {
      padding: isMobile ? 14 : 14,
      borderRadius: CARD_RADIUS,
      marginBottom: isMobile ? 10 : 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 10,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.light,
          } as any)
        : null),
    },
    mobileFiltersContextHint: {
      ...TS.bodySmall,
      color: colors.textMuted,
    },
    mobileFiltersContextButton: {
      minHeight: TOUCH,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: PILL_RADIUS,
      flex: 0,
    },
    mobileFiltersContextChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    mobileFiltersContextChip: {
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mobileFiltersContextChipText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.text,
    },
    section: {
      marginBottom: 6,
    },
    routeSectionCompact: {
      marginBottom: 2,
      gap: 4,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: CARD_RADIUS,
      padding: isMobile ? 14 : 15,
      marginBottom: isMobile ? 10 : 12,
      gap: isMobile ? 10 : 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: isMobile ? colors.boxShadows.light : colors.boxShadows.card,
            transition: 'box-shadow 0.2s ease',
          } as any)
        : null),
    },
    desktopSummaryStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 6 : 8,
      marginTop: 0,
    },
    desktopSummaryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: isMobile ? 9 : 10,
      paddingVertical: isMobile ? 6 : 7,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    desktopSummaryChipAccent: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    desktopSummaryChipText: {
      fontSize: isMobile ? 11 : 12,
      lineHeight: isMobile ? 15 : 16,
      fontWeight: '700',
      color: colors.text,
    },
    desktopSummaryChipTextAccent: {
      color: colors.primaryText,
    },
    blockHeader: {
      gap: 1,
      marginBottom: 0,
    },
    blockTitle: {
      ...TS.h3,
      fontSize: isMobile ? 15 : TS.h3.fontSize,
      lineHeight: isMobile ? 20 : TS.h3.lineHeight,
      color: colors.text,
    },
    blockHint: {
      ...TS.caption,
      color: colors.textMuted,
    },
  }) as const
