import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

export const createStyles = (colors: ThemedColors, isCompact: boolean, isWide: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  srOnly: Platform.select({
    web: {
      position: 'absolute' as const,
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden' as const,
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    },
    default: { display: 'none' as const },
  }) as any,
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    // Reserve whichever is taller: the base bottom spacing or the floating cookie
    // consent banner (published by ConsentBanner via --mt-consent-h). Without this the
    // empty-state "Обновить" CTA and the last cards sit hidden behind the banner on
    // mobile (D-013). Mirrors components/listTravel/RightColumn.tsx.
    paddingBottom:
      Platform.OS === 'web'
        ? (`calc(max(${DESIGN_TOKENS.spacing.xxl}px, var(--mt-consent-h, 0px)) + 8px)` as any)
        : DESIGN_TOKENS.spacing.xxl,
  },

  // ─── Compact top controls ───
  topBar: {
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: isCompact ? 'stretch' : 'center',
    justifyContent: 'space-between',
    gap: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingTop: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.md,
    paddingBottom: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  topBarMeta: {
    minWidth: 0,
    flexShrink: 0,
    gap: 2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h2,
    letterSpacing: -0.4,
  },
  heroCount: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '600',
  },
  topBarHint: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    fontWeight: '500',
  },
  topBarControls: {
    flex: 1,
    minWidth: 0,
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: isCompact ? 'stretch' : 'center',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },

  searchBox: {
    flex: 1,
    minWidth: isCompact ? undefined : 320,
    height: 46,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    } as any) : null),
  },
  searchIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    outlineStyle: 'none' as any,
  },
  searchClear: {
    padding: 6,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },
  countrySelect: {
    minHeight: 46,
    width: isCompact ? '100%' : 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({
      cursor: 'pointer',
      boxShadow: DESIGN_TOKENS.shadows.light,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    } as any) : null),
  },
  countrySelectActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  countrySelectDisabled: {
    opacity: 0.58,
  },
  countrySelectTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  countrySelectLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  countrySelectValue: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    fontWeight: '700',
  },
  countryMenuContent: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.lg,
    ...(Platform.OS === 'web' ? ({
      boxShadow: '0 12px 32px rgba(15,23,42,0.16)' as any,
    } as any) : null),
  },
  countryMenuItemText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  countryMenuItemTextActive: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h3,
  },
  filterChipCompact: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    minHeight: 30,
    borderRadius: DESIGN_TOKENS.radii.full,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 17,
  },
  categorySearchBox: {
    minHeight: 40,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    marginTop: -2,
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
      transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    } as any) : null),
  },
  categorySearchIcon: {
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  categorySearchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 20,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  categorySearchClear: {
    width: 26,
    height: 26,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  categorySearchEmpty: {
    width: '100%',
    minHeight: 40,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  categorySearchEmptyText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── Featured «Подборка» ───
  collectionSection: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  collectionList: {
    gap: 6,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  featuredCardActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  featuredSelectArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  featuredIconWrap: {
    width: 28,
    height: 28,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primaryAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featuredTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  featuredLabel: {
    color: colors.primaryText,
    fontSize: isCompact ? DESIGN_TOKENS.typography.sizes.sm : 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: isCompact ? 18 : 15,
  },
  featuredName: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 17,
  },
  featuredCountSlot: {
    minWidth: 28,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  featuredCount: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  featuredClear: {
    width: 28,
    height: 28,
    borderRadius: DESIGN_TOKENS.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },

  // ─── Layout ───
  layout: {
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: 'flex-start',
    gap: 0,
    marginTop: DESIGN_TOKENS.spacing.md,
  },

  // ─── Mobile filter bar ───
  mobileFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mobileFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    flex: 1,
  },
  mobileFilterToggleText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  mobileFilterToggleTextActive: {
    color: colors.primary,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '800',
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  resetBtnText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── Sidebar ───
  sidebar: {
    width: isCompact ? '100%' : 280,
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    borderRightWidth: isCompact ? 0 : StyleSheet.hairlineWidth,
    borderRightColor: colors.borderLight,
    borderBottomWidth: isCompact ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: colors.borderLight,
    ...(Platform.OS === 'web' && !isCompact ? ({
      position: 'sticky' as any,
      top: 0,
      maxHeight: '100vh',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: `${colors.borderLight} transparent`,
    } as any) : null),
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  selectedBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  selectedBadgeText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '800',
  },
  sidebarResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  sidebarResetBtnText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── Main / Results ───
  main: {
    flex: 1,
    minWidth: 0,
    width: isCompact ? '100%' : undefined,
    gap: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.xl,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.md,
  },
  resultsTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  resultsTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h1,
  },
  resultsMeta: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '500',
  },

  // ─── Cards grid ───
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.md,
    alignItems: 'stretch',
  },
  virtualCardItem: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },

  // ─── Card ───
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: isCompact ? '100%' : isWide ? '30%' : '46%',
    minWidth: isCompact ? undefined : isWide ? 280 : 260,
    maxWidth: isCompact ? '100%' : isWide ? '33.333%' : '50%',
  },
  cardInner: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        boxShadow: colors.boxShadows.card,
      } as any,
      ios: colors.shadows.medium,
      android: { elevation: colors.shadows.medium.elevation },
      default: {},
    }),
  },
  cardPressed: {
    ...Platform.select({ web: { transform: 'scale(0.992)' } as any }),
    opacity: Platform.OS === 'web' ? 1 : 0.9,
  },

  // ─── Card media ───
  cardMediaWrap: {
    position: 'relative',
    width: '100%',
    height: isCompact ? 156 : isWide ? 170 : 160,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  cardMedia: {
    width: '100%',
    height: '100%',
  },
  cardMediaPressLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  cardMediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMediaScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: colors.overlayLight,
    pointerEvents: 'none',
  },
  cardTravelActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 4,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 5,
    pointerEvents: 'none',
    ...Platform.select({
      web: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any,
    }),
  },
  categoryBadgeText: {
    color: colors.textOnDark,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Card body ───
  cardBody: {
    padding: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  cardTitle: {
    fontSize: isCompact ? 15 : 16,
    lineHeight: isCompact ? 20 : 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  cardTitlePressable: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardAddress: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
  },
  cardCountryTag: {
    flexShrink: 0,
    maxWidth: '40%',
    color: colors.textSubtle ?? colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginTop: 2,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.full,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardActionBtnSecondary: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardActionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  cardActionBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  cardActionBtnTextPrimary: {
    color: colors.textOnPrimary,
  },

  // ─── Skeleton ───
  skeletonCard: {
    // visual style applied via cardInner; this only adds skeleton-specific overrides
    borderColor: colors.borderLight,
  },
  skeletonImage: {
    height: isCompact ? 156 : isWide ? 170 : 160,
    backgroundColor: colors.backgroundSecondary,
  },
  skeletonBody: {
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  skeletonLine: {
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    height: 14,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: 2,
  },

  // ─── Load more ───
  loadMoreFooter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  loadMoreText: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '600',
  },

  // ─── State blocks ───
  stateBlock: {
    minHeight: 320,
    borderRadius: DESIGN_TOKENS.radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.xxl,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  stateTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h2,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  stateAction: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    minHeight: 44,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
  },
  stateActionText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
  stateActionPending: {
    opacity: 0.85,
  },
  stateActionPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
})

export type PlacesStyles = ReturnType<typeof createStyles>
