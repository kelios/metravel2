import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'
import { webStyle } from '@/utils/webProps'

export const createStyles = (colors: ThemedColors, isCompact: boolean, isWide: boolean) => {
  // Compact "app" layout applies to every mobile width (web + native) so /places
  // looks identical across platforms.
  const mobileCompact = isCompact
  return StyleSheet.create({
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
    // Keep search + country selector reachable while the catalog scrolls (web).
    // Desktop only: the stacked mobile bar (title + hint + search + country) is
    // ~190px tall and a sticky version ate ~30% of the phone viewport while
    // scrolling, so on compact widths it scrolls away with the content.
    ...(Platform.OS === 'web' && !isCompact ? ({
      position: 'sticky' as any,
      top: 0,
      zIndex: 30,
      backgroundColor: colors.background,
    } as any) : null),
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
  // Search + reset live on one row so the pill row below stays exactly two
  // controls; a third pill there truncated «Категории» down to «К» at 375px.
  compactSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  // Standalone (NOT merged with `searchBox`): the shared `searchBox` carries
  // `flex: 1` for the desktop topBar row, and inside the compact column that
  // shorthand resolves its basis against the vertical main axis and collapses the
  // field to 0 on native. This copy owns its own visual props; its `flex: 1` is
  // safe because it always sits in the horizontal `compactSearchRow`, where the
  // main axis is width.
  compactSearchBox: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
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
    // Keep chips visually compact but never below the 44px touch target:
    // the override previously shrank Chip's own minHeight to 30 (too small to tap).
    paddingVertical: 8,
    paddingHorizontal: 11,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
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
    marginTop: mobileCompact ? 0 : DESIGN_TOKENS.spacing.md,
  },

  // ─── Native compact sticky bar ───
  // Pinned above the scroll list so search + category filter never scroll away.
  // Tight vertical paddings keep it ≤~20% of a phone viewport.
  compactBar: {
    // Same horizontal gutter as `main`/`sidebar` so the search field lines up with
    // the results title and cards instead of sitting 8px further out.
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    paddingBottom: DESIGN_TOKENS.spacing.xs,
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  // Strictly single-line. `flexWrap: 'wrap'` here used to break at ~390px: the
  // reset button dropped to a second line that the bar's height never accounted
  // for, so it overlapped the «Категории» panel underneath, while the country
  // anchor was stretched to span both lines and squeezed its label to zero width.
  // Two flexible pills + an optional fixed-size reset always fit one row.
  compactBarRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  // Content-sized, NOT an equal half of the row: once a category is picked the
  // count badge adds ~28px and an even 50/50 split clipped «Категории» to
  // «Категор…» at 360-375dp. Zero grow/shrink keeps this label whole and lets the
  // country pill (grow 1, basis 0) absorb the leftover — «Все страны» is the
  // cheaper label to shorten.
  compactFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: 0,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compactFilterToggleActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  // Paper's `Menu` renders its anchor inside an unstyled wrapper View, so THIS —
  // not the anchor — is the flex child of `compactBarRow` and must carry the row
  // sizing. Putting `flex: 1` on the anchor instead left it in that wrapper's
  // content-height COLUMN, where native Yoga resolved the basis against an
  // undefined main size: the pill grew into a ~90dp oval and its label lost all
  // width (the row never gave the wrapper any). Web is unaffected — CSS falls
  // back to the content size — so this only ever showed up on Android.
  compactCountryAnchor: {
    flex: 1,
    minWidth: 0,
  },
  // Compact country chip — second anchor for the same country Menu, sized to sit
  // beside the Категории toggle in the native sticky bar without overflowing.
  compactCountrySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    // Width comes from `compactCountryAnchor` above; `alignSelf` only stretches
    // across the wrapper's cross axis, so it can never re-introduce the bug.
    alignSelf: 'stretch',
    minWidth: 0,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compactCountrySelectActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  compactCountrySelectValue: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  compactCountrySelectValueActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // ─── Mobile filter bar ───
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
  // Icon-only, pinned at the end of the search row: a «Сбросить» text button needs
  // ~90px, which is exactly what pushed the filter row over one line at 375px.
  compactResetBtn: {
    width: 46,
    height: 46,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // RN-Web: `cursor` нет в ViewStyle — типизированный мостик вместо `as any`.
    ...(Platform.OS === 'web' ? webStyle({ cursor: 'pointer' }) : null),
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
    // Desktop: fill the row next to the sidebar. Mobile: the column lives inside a
    // vertical ScrollView whose content height is unbounded — `flex: 1` there resolves
    // its basis against that undefined height and collapses the results to zero on
    // native (empty, non-scrolling list). Content-size it instead.
    flex: isCompact ? undefined : 1,
    minWidth: 0,
    width: isCompact ? '100%' : undefined,
    gap: mobileCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingTop: mobileCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.xl,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
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
    ...(mobileCompact
      ? DESIGN_TOKENS.typography.scale.h3
      : DESIGN_TOKENS.typography.scale.h1),
  },
  resultsMeta: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '500',
  },
  resultsHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: mobileCompact ? 1 : 0,
    minWidth: 0,
  },

  // ─── Sort control (shared desktop header + compact bar) ───
  sortSelect: {
    minHeight: mobileCompact ? DESIGN_TOKENS.touchTarget.minHeight : 40,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: mobileCompact
      ? DESIGN_TOKENS.spacing.sm
      : DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // Web cursor/transition polish is inherited from the shared Pressable role;
    // no web-only style cast here keeps this file free of extra `as any` debt.
  },
  sortSelectActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  sortSelectValue: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    fontWeight: '600',
    // Compact: let the label shrink with the header row instead of forcing the
    // pill past the viewport; desktop keeps the fixed cap.
    ...(mobileCompact ? { flexShrink: 1, minWidth: 0 } : { maxWidth: 150 }),
  },
  sortSelectValueActive: {
    color: colors.primary,
  },

  // ─── Cards grid ───
  // Mobile (compact) is a single column: a plain vertical stack. The row+wrap grid
  // is desktop-only — on native Yoga a wrapping row of `flexBasis: '100%'` items
  // mislays out (only the first card is visible above a tall empty gap), so compact
  // must be `flexDirection: 'column'`.
  cardsGrid: {
    flexDirection: isCompact ? 'column' : 'row',
    flexWrap: isCompact ? 'nowrap' : 'wrap',
    gap: DESIGN_TOKENS.spacing.md,
    alignItems: 'stretch',
  },

  // ─── Card ───
  // In the compact column each card is a full-width block. A percentage `flexBasis`
  // here would resolve against the column main axis (height) and collapse the card,
  // so compact uses an explicit width with no flex basis. Desktop keeps the grid
  // column sizing (basis/min/max) for the row-wrap layout.
  card: isCompact
    ? {
        width: '100%',
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
      }
    : {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: isWide ? '30%' : '46%',
        minWidth: isWide ? 280 : 260,
        maxWidth: isWide ? '33.333%' : '50%',
      },
  // The card fills its grid-item wrapper (`card`); the wrapper owns the column
  // sizing so the card itself must not re-declare a basis/max-width.
  // Desktop grid cells get a definite height from the row's `alignItems: 'stretch'`,
  // so the card fills it with `height: '100%'`. In the compact single column the
  // wrapper is content-height, and on native Yoga a `height: '100%'` there resolves
  // against the unbounded ScrollView height — inflating the first card to thousands
  // of px and pushing the rest off-screen. Compact cards must size to their content.
  cardFill: {
    width: '100%',
    height: isCompact ? undefined : '100%',
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

  // ─── Skeleton ───
  skeletonCard: {
    // visual style applied via cardInner; this only adds skeleton-specific overrides
    borderColor: colors.borderLight,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 1,
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
}

export type PlacesStyles = ReturnType<typeof createStyles>
