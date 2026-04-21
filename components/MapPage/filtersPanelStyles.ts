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
      height: '100%',
      maxHeight: windowHeight,
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
      gap: isMobile ? 2 : 3,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 8 : 0,
      paddingTop: isMobile ? 3 : 0,
      paddingBottom: isMobile ? 2 : 0,
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
            paddingTop: isMobile ? 4 : 2,
          } as any)
        : null),
    },
    compactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      minHeight: 22,
      paddingHorizontal: isMobile ? 2 : 0,
    },
    compactMetaText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    compactMetaCloseButton: {
      width: 26,
      height: 26,
      borderRadius: 9,
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
    compactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    compactTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
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
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    counterBadge: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    counterLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
    counterHint: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    counterValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryText,
    },
    modeHelper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    modeHelperText: {
      fontSize: 12,
      color: colors.textMuted,
      flex: 1,
    },
    content: {
      flex: 1,
      flexGrow: 1,
    },
    contentContainer: {
      paddingBottom: 64 + bottomDockReserve,
      paddingTop: isMobile ? 2 : 0,
      paddingHorizontal: isMobile ? 8 : 2,
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
    mobileFiltersContextHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    mobileFiltersContextCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    mobileFiltersContextTitle: {
      ...TS.h2,
      fontSize: 17,
      lineHeight: 22,
      color: colors.text,
    },
    mobileFiltersContextSubtitle: {
      ...TS.bodySmall,
      fontWeight: '700',
      color: colors.primaryText,
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
    mobileFiltersContextEmpty: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mobileFiltersContextEmptyText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '600',
      color: colors.textMuted,
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
      borderRadius: isMobile ? 14 : 16,
      padding: isMobile ? 14 : 14,
      marginBottom: isMobile ? 10 : 12,
      gap: isMobile ? 10 : 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            transition: 'box-shadow 0.2s ease',
          } as any)
        : null),
    },
    blockHeader: {
      gap: 2,
      marginBottom: 0,
    },
    blockTitle: {
      ...TS.h3,
      color: colors.text,
    },
    blockHint: {
      ...TS.caption,
      color: colors.textMuted,
    },
    dualInputRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'stretch',
    },
    separator: {
      width: 1,
      backgroundColor: colors.border,
    },
    transportSection: {
      gap: 8,
    },
    routeTransportStep: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 4,
      marginBottom: 6,
      borderRadius: 11,
      backgroundColor: colors.surfaceMuted ?? colors.backgroundSecondary,
    },
    routeTransportHint: {
      marginBottom: 2,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.15,
    },
    routePointsList: {
      marginTop: 6,
      gap: 8,
    },
    routePointRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routePointPill: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: colors.overlay,
    },
    routePointPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textOnDark,
    },
    routePointRemoveBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    routePointRemoveBtnDisabled: {
      opacity: 0.4,
    },
    sectionTight: {
      marginBottom: 8,
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
    input: {
      height: TOUCH,
      borderRadius: 12,
      paddingHorizontal: 14,
      ...TS.body,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    chipsContainer: {
      marginTop: 6,
    },
    chipsContent: {
      alignItems: 'center',
      paddingRight: 2,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 36,
      borderRadius: 999,
      maxWidth: 150,
      marginRight: 8,
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
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
      marginRight: 6,
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
    radiusQuickOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    radiusSelectionHint: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    filterSelectionSummary: {
      marginTop: 8,
      padding: 9,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlpha40,
      gap: 8,
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
    radiusOptionButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: TOUCH,
      minWidth: 56,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web'
        ? ({
            transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
            cursor: 'pointer',
          } as any)
        : null),
    },
    radiusOptionButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 6px 14px ${colors.primaryAlpha30}`,
          } as any)
        : null),
    },
    radiusOptionText: {
      ...TS.bodySmall,
      fontWeight: '700',
      color: colors.textMuted,
    },
    radiusOptionTextSelected: {
      color: colors.textOnPrimary,
    },
    transportTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlpha40,
      borderRadius: 12,
      padding: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      gap: 3,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
          } as any)
        : null),
    },
    transportTabsCompact: {
      borderRadius: 11,
      padding: 1,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    transportTabsDisabled: {
      opacity: 0.45,
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
    routeInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    routePill: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routePillLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 4,
    },
    routePillValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    routePillDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
    routeDistanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    routeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    routeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      flex: 1,
    },
    routeValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      flex: 2,
      textAlign: 'right',
      marginLeft: 8,
    },
    routeDistance: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primaryText,
    },
    compactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      minHeight: 36,
      marginLeft: 8,
    },
    compactButtonSmall: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 34,
    },
    compactButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
      marginLeft: 6,
    },
    footer: {
      marginTop: 8,
      paddingTop: 8,
    },
    infoBox: {
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    infoText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '700',
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    infoItem: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },
    infoBold: {
      fontWeight: '700',
      color: colors.primaryText,
    },
    routeHintContainer: {
      marginTop: 12,
      marginBottom: 12,
    },
    routeStatsContainer: {
      marginTop: 0,
      marginBottom: 0,
    },
    stepper: {
      marginTop: 4,
      marginBottom: 12,
      gap: 8,
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
    stepItemDone: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeStart: {
      backgroundColor: colors.success,
    },
    stepBadgeEnd: {
      backgroundColor: colors.danger,
    },
    stepBadgeTransport: {
      backgroundColor: colors.primary,
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
    routeBuilt: {
      marginTop: 6,
      padding: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    routeBuiltTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primaryText,
      marginBottom: 4,
    },
    routeBuiltMeta: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    noPointsToast: {
      marginTop: 12,
      padding: 11,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
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
    stepBlock: {
      padding: 9,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 8,
      gap: 6,
    },
    stepBlockCompact: {
      padding: 8,
      gap: 5,
      marginBottom: 8,
    },
    routeResultStep: {
      paddingVertical: 8,
      gap: 4,
      marginBottom: 6,
    },
    stepHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepBlockTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    stepInlineHint: {
      fontSize: 11,
      color: colors.primaryText,
      fontWeight: '700',
    },
    stepInlineHintMuted: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    addressToggle: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: 4,
    },
    addressToggleText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 13,
    },
    sectionDisabled: {
      opacity: 0.6,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    },
    actionGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlpha40,
      minHeight: 36,
    },
    actionGhostText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
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
    swapButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    swapButtonText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 13,
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
        ? ({
            position: 'sticky',
            bottom: bottomDockReserve,
            backgroundColor: colors.surfaceAlpha40,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            paddingTop: isMobile ? 8 : 4,
            paddingBottom: isMobile ? 8 : 4,
            borderTopWidth: isMobile ? StyleSheet.hairlineWidth : 0,
            borderTopColor: isMobile ? colors.borderLight : 'transparent',
          } as any)
        : {
            paddingTop: isMobile ? 8 : 4,
            paddingBottom: isMobile ? 8 : 0,
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
      paddingHorizontal: isMobile ? 10 : 0,
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
    ctaPrimaryHover: {
      ...(Platform.OS === 'web'
        ? ({
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 28px rgba(255, 146, 43, 0.45)',
          } as any)
        : null),
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
    footerPreview: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 6,
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
      paddingVertical: 10,
      paddingHorizontal: 0,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
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
