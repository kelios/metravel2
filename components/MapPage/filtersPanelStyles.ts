import { Dimensions, Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

const TS = DESIGN_TOKENS.typography.scale;
const TOUCH = 44;

export const getFiltersPanelStyles = (colors: ThemedColors, isMobile: boolean, windowWidth: number) => {
  const panelWidth = isMobile ? '100%' : Math.max(Math.min(windowWidth - 32, 420), 280);
  const windowHeight = Dimensions.get('window').height;
  const bottomDockReserve = Platform.OS === 'web' && isMobile ? (LAYOUT?.tabBarHeight ?? 56) : 0;

  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: isMobile ? 0 : 20,
      padding: isMobile ? 0 : 12,
      width: panelWidth,
      maxWidth: '100%',
      height:
        Platform.OS === 'web' && isMobile
          ? ('100%' as const)
          : ('100%' as const),
      maxHeight:
        Platform.OS === 'web' && isMobile
          ? ('100%' as const)
          : windowHeight,
      display: 'flex',
      flexDirection: 'column',
      alignSelf: isMobile ? 'stretch' : 'flex-start',
      ...(isMobile
        ? {}
        : Platform.OS === 'web'
          ? ({
              borderWidth: 1,
              borderColor: colors.borderLight,
              boxShadow: '0 16px 40px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
            } as any)
          : {
              shadowColor: (colors.shadows as any)?.shadowColor ?? DESIGN_TOKENS.shadowsNative.light.shadowColor,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.1,
              shadowRadius: 24,
              elevation: 8,
            }),
    },
    headerContainer: {
      marginBottom: 12,
    },
    stickyTop: {
      gap: isMobile ? 4 : 3,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 4 : 0,
      paddingTop: isMobile ? 4 : 0,
      paddingBottom: isMobile ? 4 : 0,
      borderBottomWidth: isMobile ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: isMobile ? colors.border : 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backgroundColor: colors.surfaceAlpha40,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            paddingTop: isMobile ? 6 : 2,
          } as any)
        : null),
    },
    compactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      minHeight: 28,
      paddingHorizontal: isMobile ? 2 : 0,
      marginBottom: 2,
    },
    compactMetaBadge: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 28,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    compactMetaText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.text,
    },
    compactMetaCloseButton: {
      width: 28,
      height: 28,
      borderRadius: 10,
      marginHorizontal: 0,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    modeSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: isMobile ? 2 : 0,
      paddingTop: isMobile ? 2 : 4,
    },
    modeSummaryText: {
      flex: 1,
      minWidth: 0,
      fontSize: isMobile ? 11 : 12,
      fontWeight: '700',
      color: colors.text,
    },
    modeSummaryHint: {
      fontSize: isMobile ? 10 : 11,
      lineHeight: isMobile ? 13 : 15,
      color: colors.textMuted,
      paddingHorizontal: isMobile ? 2 : 0,
      paddingBottom: isMobile ? 2 : 2,
    },
    compactTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    content: {
      flex: 1,
      flexGrow: 1,
      minHeight: 0,
    },
    contentContainer: {
      paddingBottom: 64 + bottomDockReserve,
      paddingTop: isMobile ? 4 : 0,
      paddingHorizontal: isMobile ? 6 : 2,
      flexGrow: 1,
    },
    filtersStatusCard: {
      padding: isMobile ? 14 : 14,
      borderRadius: 16,
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
      borderRadius: 999,
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
      borderRadius: 16,
      marginBottom: isMobile ? 10 : 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 10,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
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
      borderRadius: 999,
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
      borderRadius: 999,
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
      marginBottom: 8,
    },
    routeSectionCompact: {
      marginBottom: 4,
      gap: 6,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: isMobile ? 18 : 16,
      padding: isMobile ? 10 : 14,
      marginBottom: isMobile ? 8 : 12,
      gap: isMobile ? 6 : 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: isMobile
              ? '0 10px 28px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)'
              : '0 1px 2px rgba(15,23,42,0.04)',
            transition: 'box-shadow 0.2s ease',
          } as any)
        : null),
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
    separator: {
      width: 1,
      backgroundColor: colors.border,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase' as const,
    },
    sectionHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      lineHeight: 15,
    },
    chipsContainer: {
      marginTop: 4,
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
      borderRadius: 999,
      maxWidth: 150,
      marginRight: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer',
          } as any)
        : null),
    },
    categoryChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 6px 14px ${colors.primaryAlpha30}`,
          } as any)
        : null),
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
      marginRight: 4,
    },
    categoryChipTextSelected: {
      color: colors.primaryText,
      fontWeight: '700',
    },
    categoryChipIconButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
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
      borderRadius: 14,
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
      gap: 8,
      marginBottom: isMobile ? 6 : 10,
    },
    mobileFiltersQuickChips: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      minWidth: 0,
    },
    mobileFiltersQuickChip: {
      maxWidth: '100%',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mobileFiltersQuickChipText: {
      fontSize: 11,
      lineHeight: 13,
      fontWeight: '700',
      color: colors.text,
    },
    mobileFiltersQuickButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      flexShrink: 0,
    },
    radiusOptionsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    radiusOptionChip: {
      maxWidth: '100%',
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
      borderRadius: 12,
      backgroundColor: colors.surfaceAlpha40,
      gap: isMobile ? 6 : 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filterSelectionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterSelectionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filterSelectionChipText: {
      maxWidth: 180,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    routeInfo: {
      backgroundColor: colors.surfaceAlpha40,
      borderRadius: 11,
      padding: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'none',
        } as any,
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    routeDistance: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primaryText,
    },
    footer: {
      marginTop: 8,
      paddingTop: 8,
    },
    infoText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '700',
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 9,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 12,
    },
    stepContent: {
      flex: 1,
      gap: 2,
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    stepSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    noPointsToast: {
      marginTop: 8,
      padding: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    noPointsTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    noPointsSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },
    noPointsActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    statusCard: {
      backgroundColor: colors.surfaceAlpha40,
      borderRadius: 10,
      padding: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'none',
        } as any,
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    accordionHeader: {
      marginTop: 2,
      marginBottom: 4,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accordionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
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
    mapToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 11,
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
    stickyFooter: {
      ...(Platform.OS === 'web'
        ? isMobile
          ? ({
              backgroundColor: colors.surfaceAlpha40,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              paddingTop: 6,
              paddingBottom: 6,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderLight,
            } as any)
          : ({
              position: 'sticky',
              bottom: bottomDockReserve,
              backgroundColor: colors.surfaceAlpha40,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              paddingTop: 4,
              paddingBottom: 4,
            } as any)
        : {
            paddingTop: isMobile ? 6 : 4,
            paddingBottom: isMobile ? 6 : 0,
            backgroundColor: colors.surface,
            borderTopWidth: isMobile ? StyleSheet.hairlineWidth : 0,
            borderTopColor: isMobile ? colors.borderLight : 'transparent',
          }),
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: isMobile ? 8 : 0,
      paddingBottom: isMobile ? 2 : 0,
      flexWrap: 'wrap',
    },
    mobileFooterSummary: {
      paddingHorizontal: isMobile ? 10 : 0,
      paddingBottom: 8,
      gap: 2,
    },
    mobileFooterSummaryTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },
    mobileFooterSummaryHint: {
      fontSize: 10,
      lineHeight: 14,
      color: colors.textMuted,
    },
    ctaButton: {
      borderRadius: isMobile ? DESIGN_TOKENS.radii.sm : DESIGN_TOKENS.radii.md,
      paddingHorizontal: isMobile ? 10 : 12,
      paddingVertical: isMobile ? 5 : 8,
      minHeight: isMobile ? 34 : 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: Platform.OS === 'web' ? undefined : 1,
    },
    ctaPrimary: {
      minHeight: isMobile ? 38 : 48,
      paddingVertical: isMobile ? 8 : 12,
      paddingHorizontal: isMobile ? 14 : 18,
      borderRadius: isMobile ? 13 : 15,
      flex: 1,
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 10px 24px ${colors.primaryAlpha30}`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          } as any)
        : {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }),
    },
    ctaPrimaryDisabled: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
      borderWidth: 1,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
          } as any)
        : {
            shadowOpacity: 0,
            elevation: 0,
          }),
    },
    helperText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    // ═══════════════════════════════════════════════════════════════
    // LIGHT ROUTE PANEL — современный светлый легкий дизайн
    // ═══════════════════════════════════════════════════════════════
    lightStepBlock: {
      paddingVertical: isMobile ? 4 : 10,
      paddingHorizontal: 0,
      gap: isMobile ? 6 : 8,
      borderBottomWidth: isMobile ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    lightStepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    lightStepNumber: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 22,
      overflow: 'hidden',
    },
    lightStepTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    lightStepBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    lightStepHint: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    lightCheckBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.successLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    lightCheckText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
    },
    lightSectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
    },
    lightPointsList: {
      gap: 6,
    },
    lightPointRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    lightPointDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightPointDotText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    lightPointLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    lightPointRemove: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    lightPointRemoveDisabled: {
      opacity: 0.3,
    },
  });
};

export default getFiltersPanelStyles;
