import { Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';

type ThemedColors = ReturnType<typeof useThemedColors>;

export const createSecondaryStyles = (colors: ThemedColors) => ({
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
  cardsContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
    paddingTop: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        minHeight: 900,
      },
    }),
  },
  cardsContainerMobile: {
    paddingBottom: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
    minHeight: 720,
  },
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
