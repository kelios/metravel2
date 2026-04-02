import { Dimensions, Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

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
      ...(isMobile
        ? {}
        : {
            shadowColor: (colors.shadows as any)?.shadowColor ?? DESIGN_TOKENS.shadowsNative.light.shadowColor,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.1,
            shadowRadius: 24,
            elevation: 8,
          }),
      alignSelf: isMobile ? 'stretch' : 'flex-start',
      ...(Platform.OS === 'web' && !isMobile
        ? ({
            boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          } as any)
        : null),
    },
    headerContainer: {
      marginBottom: 12,
    },
    stickyTop: {
      gap: 3,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 10 : 0,
      paddingTop: isMobile ? 4 : 0,
      paddingBottom: isMobile ? 3 : 0,
      borderBottomWidth: isMobile ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: isMobile ? colors.border : 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backgroundColor: colors.surface,
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
      width: 32,
      height: 32,
      borderRadius: 9,
      marginHorizontal: 0,
      backgroundColor: colors.backgroundSecondary,
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
      paddingTop: 4,
    },
    modeSummaryText: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    modeSummaryHint: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textMuted,
      paddingHorizontal: isMobile ? 2 : 0,
      paddingBottom: isMobile ? 4 : 2,
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
      fontSize: 14,
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
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
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
      paddingTop: isMobile ? 4 : 0,
      paddingHorizontal: isMobile ? 10 : 0,
      flexGrow: 1,
    },
    filtersStatusCard: {
      padding: isMobile ? 14 : 12,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 8,
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
      fontSize: 14,
      fontWeight: '800',
      color: colors.primaryText,
      letterSpacing: -0.2,
    },
    filtersStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filtersStatusBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
    },
    filtersStatusDescription: {
      fontSize: 12,
      lineHeight: 18,
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
      borderRadius: 14,
      padding: isMobile ? 16 : 12,
      marginBottom: 10,
      gap: 10,
      borderWidth: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
            transition: 'box-shadow 0.2s ease',
          } as any)
        : DESIGN_TOKENS.shadowsNative.light),
    },
    blockHeader: {
      gap: 2,
      marginBottom: 0,
    },
    blockTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    blockHint: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 13,
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
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.overlay,
    },
    routePointPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textOnDark,
    },
    routePointRemoveBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
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
      height: 36,
      borderRadius: 9,
      paddingHorizontal: 10,
      fontSize: 13,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      ...DESIGN_TOKENS.shadowsNative.light,
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
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 18,
      maxWidth: 128,
      marginRight: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          } as any)
        : null),
    },
    categoryChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 2px 8px rgba(255, 146, 43, 0.2)',
          } as any)
        : null),
    },
    categoryChipText: {
      fontSize: 13,
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
      width: 28,
      height: 28,
      borderRadius: 14,
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
      paddingHorizontal: 10,
      paddingVertical: 6,
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
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    filterSelectionSummaryTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
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
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
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
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 38,
      minWidth: 56,
      borderRadius: 18,
      borderWidth: 0,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web'
        ? ({
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
          } as any)
        : null),
    },
    radiusOptionButtonSelected: {
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 4px 16px rgba(255, 146, 43, 0.35)',
            transform: 'scale(1.03)',
          } as any)
        : null),
    },
    radiusOptionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
    },
    radiusOptionTextSelected: {
      color: colors.textOnPrimary,
    },
    transportTabs: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 0,
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
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderRadius: 9,
      padding: 10,
      ...DESIGN_TOKENS.shadowsNative.light,
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
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      minHeight: 40,
      marginLeft: 8,
    },
    compactButtonSmall: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 36,
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
      padding: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary,
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
      padding: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
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
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
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
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      minHeight: 40,
    },
    actionGhostText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    statusCard: {
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      borderRadius: 10,
      padding: 10,
      ...DESIGN_TOKENS.shadowsNative.light,
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
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 11,
      backgroundColor: colors.backgroundSecondary,
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
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
            backgroundColor: colors.surface,
            paddingTop: 4,
            paddingBottom: isMobile ? 2 : 4,
          } as any)
        : {
            paddingTop: 4,
          }),
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: isMobile ? 14 : 0,
      paddingBottom: isMobile ? 4 : 0,
    },
    mobileFooterSummary: {
      paddingHorizontal: isMobile ? 14 : 0,
      paddingBottom: 8,
      gap: 2,
    },
    mobileFooterSummaryTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    mobileFooterSummaryHint: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textMuted,
    },
    ctaButton: {
      borderRadius: isMobile ? DESIGN_TOKENS.radii.sm : DESIGN_TOKENS.radii.md,
      paddingHorizontal: isMobile ? 12 : 14,
      paddingVertical: isMobile ? 6 : 10,
      minHeight: isMobile ? 38 : 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: Platform.OS === 'web' ? undefined : 1,
    },
    ctaPrimary: {
      minHeight: isMobile ? 48 : 56,
      paddingVertical: isMobile ? 12 : 16,
      paddingHorizontal: isMobile ? 20 : 24,
      borderRadius: 16,
      flex: 1,
      gap: 10,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 4px 20px rgba(255, 146, 43, 0.35)',
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
      fontSize: 13,
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
