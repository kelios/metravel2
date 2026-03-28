import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';

export const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'row',
      overflowX: 'hidden',
      width: '100%',
      maxWidth: '100%',
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
    },
    rootMobile: {
      flexDirection: 'column',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
      overflow: 'hidden',
      width: '100%',
    },
    contentMobile: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    sidebar: {
      width: 320,
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
    },
    sidebarMobile: {
      width: '100%',
      borderRightWidth: 0,
      borderBottomWidth: 1,
    },
    listContainer: {
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    listContainerMobile: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    exportBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 0,
      marginBottom: 0,
      backgroundColor: 'transparent',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
      minHeight: 48,
    },
    exportBarMobile: {
      flexDirection: 'column',
      gap: DESIGN_TOKENS.spacing.sm,
      alignItems: 'stretch',
    },
    exportBarMobileWeb: {
      marginHorizontal: -DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    exportBarInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    exportBarHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    exportBarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    exportBarInfoTitle: {
      fontSize: 16,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.text,
      lineHeight: 24,
    },
    exportBarCountBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
    },
    exportBarCountBadgeText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    },
    exportBarHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    exportBarActions: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      alignItems: 'center',
      flexShrink: 0,
    },
    exportBarMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
    },
    exportBarInfoSubtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      marginBottom: 0,
    },
    exportBarInfoActions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    linkButton: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryText,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      textDecorationLine: 'none',
    },
    linkButtonDanger: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.danger,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      textDecorationLine: 'none',
    },
    exportBarButtons: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      alignItems: 'center',
    },
    exportBarButtonsMobile: {
      flexDirection: 'column',
      width: '100%',
      alignItems: 'stretch',
    },
    progressWrapper: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    exportWorkspace: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      gap: DESIGN_TOKENS.spacing.sm,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        } as any,
        ios: DESIGN_TOKENS.shadowsNative.light,
        android: { elevation: 2 },
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    exportWorkspaceMobile: {
      padding: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    exportWorkspaceDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: -DESIGN_TOKENS.spacing.lg,
    },
    exportWorkspaceDividerMobile: {
      marginHorizontal: -DESIGN_TOKENS.spacing.md,
    },
    selectedOrderStrip: {
      gap: 8,
    },
    selectedOrderStripHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    selectedOrderStripIcon: {
      color: colors.primary,
    },
    selectedOrderStripLabel: {
      fontSize: 13,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    selectedOrderStripHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textTertiary,
    },
    selectedOrderPanel: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      marginBottom: 0,
      padding: 0,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    selectedOrderHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    selectedOrderHeader: {
      gap: 4,
      flex: 1,
      minWidth: 0,
    },
    selectedOrderTitle: {
      marginTop: 0,
      marginBottom: 0,
    },
    selectedOrderSubtitle: {
      maxWidth: 560,
      lineHeight: 22,
    },
    selectedOrderCountBadge: {
      minWidth: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderAccent,
      flexShrink: 0,
    },
    selectedOrderCountBadgeText: {
      color: colors.primaryText,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    selectedOrderList: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingRight: DESIGN_TOKENS.spacing.sm,
      ...(Platform.OS === 'web'
        ? ({
            width: 'max-content',
            minWidth: '100%',
            paddingBottom: DESIGN_TOKENS.spacing.xs,
          } as any)
        : null),
    },
    selectedOrderScroller: {
      minHeight: 0,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'hidden',
            overflowY: 'hidden',
          } as any)
        : null),
    },
    selectedOrderGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
      gap: DESIGN_TOKENS.spacing.sm,
      alignItems: 'start',
      width: '100%',
      minHeight: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingRight: 4,
    },
    selectedOrderItem: {
      width: 128,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'grab',
          userSelect: 'none',
        } as any,
      }),
    },
    selectedOrderItemDragging: {
      opacity: 0.58,
      ...Platform.select({
        web: {
          borderColor: colors.primary,
          cursor: 'grabbing',
        } as any,
      }),
    },
    selectedOrderItemDropTarget: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: '0 6px 20px rgba(77, 124, 112, 0.18)',
        } as any,
      }),
    },
    selectedOrderItemInfo: {
      width: '100%',
    },
    selectedOrderMediaWrap: {
      position: 'relative',
      width: 128,
      height: 96,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        } as any,
      }),
    },
    selectedOrderMedia: {
      width: '100%',
      height: '100%',
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    selectedOrderMediaPlaceholder: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    selectedOrderIndexBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      zIndex: 3,
      minWidth: 22,
      height: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        } as any,
      }),
    },
    selectedOrderIndex: {
      minWidth: 10,
      textAlign: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
    },
    selectedOrderTitleOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 3,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomLeftRadius: 11,
      borderBottomRightRadius: 11,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(8px)',
        } as any,
      }),
    },
    selectedOrderOverlayTitle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      lineHeight: 16,
    },
    selectedOrderActions: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    selectedOrderDragHandle: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.95)',
      ...Platform.select({
        web: {
          cursor: 'grab',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px)',
        } as any,
      }),
    },
    selectedOrderControlsOverlay: {
      position: 'absolute',
      left: 6,
      right: 6,
      top: '50%',
      zIndex: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.xs,
      ...Platform.select({
        web: {
          transform: [{ translateY: -14 }],
        } as any,
      }),
    },
    selectedOrderActionButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderWidth: 0,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(6px)',
          transition: 'opacity 0.15s ease',
        } as any,
      }),
    },
    selectedOrderActionButtonDisabled: {
      opacity: 0.38,
    },
    recommendationsLoader: {
      marginTop: DESIGN_TOKENS.spacing.lg,
      padding: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      alignItems: 'center',
    },
    recommendationsSkeleton: {
      width: '100%',
    },
    recommendationsSkeletonHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    recommendationsSkeletonTitle: {
      width: 120,
      height: 20,
      backgroundColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    recommendationsSkeletonTabs: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsSkeletonContent: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsSkeletonCard: {
      flex: 1,
      height: 80,
      backgroundColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    recommendationsTabs: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    filtersToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filtersToggleText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
    },
    filtersToggleTextActive: {
      color: colors.primaryText,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    filtersOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
      zIndex: 10,
    },
    filtersOverlayContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '80%',
      backgroundColor: colors.surface,
      borderBottomLeftRadius: DESIGN_TOKENS.radii.md,
      borderBottomRightRadius: DESIGN_TOKENS.radii.md,
      padding: DESIGN_TOKENS.spacing.md,
    },
    filtersOverlayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    filtersOverlayTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    filtersOverlayClose: {
      padding: DESIGN_TOKENS.spacing.xs,
    },
    filtersOverlayScroll: {
      flex: 1,
    },
    filtersOverlayFooter: {
      paddingTop: DESIGN_TOKENS.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    filtersOverlayFooterButtons: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    filtersOverlayFooterButton: {
      flex: 1,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    listHeaderTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xl,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    listHeaderSubtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
    listHeaderActions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    listHeaderAction: {
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    listHeaderActionText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
    },
    listHeaderActionActive: {
      borderColor: colors.primary,
    },
    listHeaderActionActiveText: {
      color: colors.primaryText,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    listHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    listHeaderRightText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    listHeaderRightValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
    },
    list: {
      flex: 1,
    },
    listMobile: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    listEmpty: {
      padding: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    listEmptyTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    listEmptyText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    listEmptyButton: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    listFooter: {
      paddingVertical: DESIGN_TOKENS.spacing.md,
    },
    listFooterText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    listFooterButton: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    pagination: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    paginationButton: {
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paginationButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
    },
    paginationButtonDisabled: {
      opacity: 0.5,
    },
    paginationInfo: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    stickyFooter: {
      position: 'sticky' as any,
      bottom: 0,
      backgroundColor: colors.background,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stickyFooterButtons: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    stickyFooterButton: {
      flex: 1,
    },
    rightColumn: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
      ...(Platform.OS === 'web' ? ({ paddingTop: DESIGN_TOKENS.spacing.lg } as const) : null),
    },
    rightColumnMobile: {
      width: '100%',
      marginLeft: 0,
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    // ✅ SEARCH HEADER: Прикрепленный заголовок поиска
    searchHeader: {
      position: 'relative',
      zIndex: 10,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        } as any,
        ios: DESIGN_TOKENS.shadowsNative.light,
        android: { elevation: 2 },
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    // ✅ CARDS CONTAINER: Прокручиваемый контейнер для карточек
    cardsContainer: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
      // Горизонтальные отступы задаются динамически через contentPadding, чтобы избежать лишних белых полей
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.md,
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
    },
    cardsContainerMobile: {
      // Reserve space for the fixed mobile footer/dock so the last card is not covered.
      // Uses tabBarHeight as a stable dock height across platforms.
      paddingBottom: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
      minHeight: 720,
    },
    // ✅ CARDS GRID: Flexbox layout for both platforms
    cardsGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    resultsCount: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    recommendationsTabsWrapper: {
      marginTop: DESIGN_TOKENS.spacing.lg,
    },
    recommendationsTabsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsTabsTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    recommendationsTabsAction: {
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recommendationsTabsActionText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
    },
    recommendationsTabsContent: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsTabsFooter: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    recommendationsTabsFooterText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    recommendationsTabsFooterButton: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsTabsFooterButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryText,
      textDecorationLine: 'underline',
    },
    emptyState: {
      padding: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyStateTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    emptyStateText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    emptyStateActions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    emptyStateAction: {
      flex: 1,
    },
    headerBadge: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primarySoft,
    },
    headerBadgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryText,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    searchBar: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    filtersSummary: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    cardGrid: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    cardGridWeb: {
      paddingBottom: LAYOUT?.tabBarHeight ?? 56,
    },
    loadMoreButton: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    loadMoreButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryText,
      textAlign: 'center',
    },
    listFooterSpacing: {
      height: DESIGN_TOKENS.spacing.lg,
    },
    listHeaderSpacer: {
      height: DESIGN_TOKENS.spacing.md,
    },
  });
