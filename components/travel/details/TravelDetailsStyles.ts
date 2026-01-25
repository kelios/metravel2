import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56

/* ✅ РЕДИЗАЙН: Компактные константы (по аналогии с CompactSideBarTravel) */
export const COMPACT_SPACING = {
  // Уменьшение на 20-25%
  hero: {
    mobile: 18, // было 24
    desktop: 24, // было 32
  },
  section: {
    mobile: 14, // было 18-20
    desktop: 18, // было 24
  },
  card: {
    mobile: 12, // было 16
    desktop: 14, // было 18
  },
  margin: {
    section: 14, // было 18
    card: 9, // было 12
  },
} as const;

export const COMPACT_TYPOGRAPHY = {
  // Уменьшение font sizes на 15-20%
  title: {
    mobile: 20, // было 24
    desktop: 22, // было 26-28
  },
  subtitle: {
    mobile: 16, // было 18-20
    desktop: 18, // было 20-22
  },
  body: {
    mobile: 14, // было 16
    desktop: 14, // было 16
  },
  caption: {
    mobile: 12, // было 13-14
    desktop: 13, // было 14
  },
} as const;

/* -------------------- helpers -------------------- */
const getShadowStyle = (colors: ThemedColors, shadowType: 'light' | 'medium' = 'light') => {
  if (Platform.OS === 'web') {
    return { boxShadow: shadowType === 'light' ? colors.boxShadows.light : colors.boxShadows.card };
  }
  return shadowType === 'light' ? colors.shadows.light : colors.shadows.medium;
};

/* -------------------- styles -------------------- */
export const getTravelDetailsStyles = (colors: ThemedColors) => StyleSheet.create({
  // ✅ РЕДИЗАЙН: Светлый современный фон
  wrapper: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  safeArea: { flex: 1 },
  mainContainer: { 
    flex: 1, 
    flexDirection: "row",
    maxWidth: 1600,
    width: "100%",
    marginHorizontal: "auto" as any,
  },
  mainContainerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    maxWidth: '100%',
    marginHorizontal: 0 as any,
  },
  lazySectionReserved: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
  },
  webDeferredSection: Platform.select({
    web: {
      // Defer render/paint for below-the-fold sections without CLS.
      contentVisibility: 'auto',
      contain: 'layout style paint',
      containIntrinsicSize: '720px 480px',
    } as any,
    default: {},
  }),

  // ✅ РЕДИЗАЙН: Адаптивное боковое меню
  sideMenuBase: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.xxl,
      web: DESIGN_TOKENS.spacing.xl,
    }),
  },
  sectionContainer: {
    marginBottom: Platform.select({
      default: COMPACT_SPACING.section.desktop, // было lg (24px)
      web: COMPACT_SPACING.section.desktop + 4, // было xxl (48px), теперь 22
    }),
    // Horizontal gutters are applied once at the page level (contentWrapper).
    // Keeping additional padding here makes mobile content look "squeezed".
    width: "100%",
  },
  
  contentStable: {
    // Предотвращает layout shift при загрузке контента
    minHeight: DESIGN_TOKENS.spacing.xxl,
  },
  
  contentOuter: {
    flex: 1,
  },
  
  contentWrapper: {
    flex: 1,
  },
  
  sectionTabsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  quickFactsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },

  quickJumpWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  quickJumpScroll: {
    flexGrow: 0,
  },
  quickJumpScrollContent: {
    paddingRight: DESIGN_TOKENS.spacing.md,
  },
  quickJumpChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: COMPACT_SPACING.card.mobile, // было sm (12px)
    paddingHorizontal: Platform.select({
      default: COMPACT_SPACING.section.mobile, // было md (16px)
      web: COMPACT_SPACING.card.mobile, // было sm+xs (14px)
    }),
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    marginRight: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    ...(getShadowStyle(colors, 'light') as any),
  },
  quickJumpChipPressed: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.borderAccent,
  },
  quickJumpLabel: {
    fontSize: COMPACT_TYPOGRAPHY.body.mobile, // было 14
    fontWeight: "600" as any,
    color: colors.text,
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },
  
  descriptionIntroWrapper: {
    marginBottom: COMPACT_SPACING.section.mobile + 4, // было lg (24px)
  },
  
  descriptionIntroTitle: {
    fontSize: Platform.select({
      default: COMPACT_TYPOGRAPHY.subtitle.mobile, // было 22
      web: COMPACT_TYPOGRAPHY.subtitle.desktop, // было 24
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  
  descriptionIntroText: {
    fontSize: COMPACT_TYPOGRAPHY.body.mobile, // было md (16)
    color: colors.textMuted,
    lineHeight: Platform.select({ default: 22, web: 21 }), // уменьшено
  },

  decisionSummaryBox: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.lg, web: DESIGN_TOKENS.spacing.xl }),
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.accentSoft,
    ...(getShadowStyle(colors, 'medium') as any),
  },
  decisionSummaryTitle: {
    fontSize: Platform.select({ default: 22, web: 24 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryList: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  decisionSummaryBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryBulletIcon: {
    width: 20,
    marginTop: DESIGN_TOKENS.spacing.xxs,
    opacity: 0.75,
  },
  decisionSummaryBulletText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 28, web: 26 }),
    color: colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
  },
  decisionSummarySubBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: DESIGN_TOKENS.spacing.sm,
    paddingLeft: DESIGN_TOKENS.spacing.sm + DESIGN_TOKENS.spacing.xs,
  },
  decisionSummarySubBulletIcon: {
    width: 20,
    marginTop: DESIGN_TOKENS.spacing.xs,
    opacity: 0.6,
  },
  decisionSummarySubBulletText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: colors.text,
    opacity: 0.9,
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
  },
  decisionSummaryBadge: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  decisionSummaryBadgeInfo: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  decisionSummaryBadgePositive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successLight,
  },
  decisionSummaryBadgeNegative: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLight,
  },
  decisionSummaryBadgeText: {
    fontSize: 14,
    fontWeight: '800' as any,
    letterSpacing: 0.2,
  },
  decisionSummaryBadgeTextInfo: {
    color: colors.text,
  },
  decisionSummaryBadgeTextPositive: {
    color: colors.successDark,
  },
  decisionSummaryBadgeTextNegative: {
    color: colors.dangerDark,
  },
  decisionSummaryText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  
  backToTopWrapper: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  
  backToTopText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  
  navigationArrowsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  
  authorCardContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  shareButtonsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  ctaContainer: {
    marginTop: DESIGN_TOKENS.spacing.xl,
  },
  
  sideMenuNative: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  sideMenuWebDesktop: {
    position: "sticky" as any,
    top: HEADER_OFFSET_DESKTOP as any,
    backgroundColor: colors.surfaceMuted,
    backdropFilter: "blur(20px)" as any,
    // Ensure the sidebar can scroll independently on long menus
    maxHeight: `calc(100vh - ${HEADER_OFFSET_DESKTOP}px)` as any,
    overflow: "hidden" as any,
  },
  sideMenuWebMobile: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 0,
    maxHeight: "100vh" as any,
    overflowY: "auto" as any,
    paddingTop: HEADER_OFFSET_MOBILE + DESIGN_TOKENS.spacing.xl,
  },

  // ✅ РЕДИЗАЙН: Современные карточки с улучшенными тенями
  // ✅ РЕДИЗАЙН: Унифицированные карточки с единой системой радиусов (12px)
  sectionHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: COMPACT_SPACING.section.mobile, // было md (16px)
      web: COMPACT_SPACING.section.desktop, // было xl (32px)
    }),
    paddingHorizontal: Platform.select({
      default: COMPACT_SPACING.section.mobile, // было md (16px)
      web: COMPACT_SPACING.section.desktop, // было xl (32px)
    }),
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 56, // было 64
    ...(getShadowStyle(colors, 'medium') as any),
  },
  sectionHeaderPositive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successLight,
  },
  sectionHeaderNegative: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLight,
  },
  sectionHeaderInfo: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoLight,
  },
  sectionHeaderActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0 2px 10px rgba(0, 0, 0, 0.10)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.10,
          shadowRadius: 10,
          elevation: 3,
        }
    ),
  },
  sectionHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 1,
    flexGrow: 1,
  },
  
  sectionHeaderIcon: {
    width: Platform.select({ default: 32, web: 36 }),
    height: Platform.select({ default: 32, web: 36 }),
    borderRadius: Platform.select({ default: 16, web: 18 }),
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 0,
  },
  sectionHeaderBadge: {
    fontSize: 14,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    flexShrink: 0,
  },

  sectionHeaderText: { 
    fontSize: Platform.select({
      default: COMPACT_TYPOGRAPHY.title.mobile, // было 22
      web: COMPACT_TYPOGRAPHY.title.desktop + 2, // было 26, теперь 24
    }),
    fontWeight: '700' as any,
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: Platform.select({
      default: 28, // было 30
      web: 32, // было 34
    }),
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 14, web: 16 }),
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.sm,
    lineHeight: Platform.select({ default: 22, web: 24 }),
  },
  sliderContainer: {
    width: "100%",
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: "hidden",
    marginBottom: 0,
    backgroundColor: "transparent",
    ...(getShadowStyle(colors, 'light') as any),
  },

  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: "hidden",
    backgroundColor: colors.text,
  },

  playOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.overlay,
  },
  neutralActionButton: {
    alignSelf: "flex-start",
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  neutralActionButtonPressed: {
    opacity: 0.92,
    backgroundColor: colors.backgroundTertiary,
  },
  neutralActionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600" as any,
  },
  videoHintText: {
    color: colors.textOnDark,
    fontSize: 14,
    marginTop: DESIGN_TOKENS.spacing.sm,
    textAlign: "center",
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },

  descriptionContainer: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      default: COMPACT_SPACING.section.mobile, // было md (16px)
      web: COMPACT_SPACING.section.desktop, // было xl (32px), теперь 18
    }),
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...(getShadowStyle(colors, 'medium') as any),
  },

  mobileInsightTabsWrapper: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mobileInsightLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  mobileInsightTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mobileInsightChip: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.backgroundTertiary,
  },
  mobileInsightChipActive: {
    backgroundColor: colors.primary,
  },
  mobileInsightChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "500",
    color: colors.textMuted,
  },
  mobileInsightChipTextActive: {
    color: colors.textOnPrimary,
  },

  mapEmptyState: {
    width: "100%",
    padding: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  mapEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
    color: colors.textMuted,
  },
  nearSubtitle: {
    color: colors.successDark,
  },
  popularSubtitle: {
    color: colors.warningDark,
  },
  sectionBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  sectionBadgePill: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 999,
  },
  sectionBadgeNear: {
    backgroundColor: colors.successSoft,
  },
  sectionBadgePopular: {
    backgroundColor: colors.warningSoft,
  },
  sectionBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: colors.text,
  },
  sectionBadgeTextNear: {
    color: colors.successDark,
  },
  sectionBadgeTextPopular: {
    color: colors.warningDark,
  },

  fallback: { paddingVertical: DESIGN_TOKENS.spacing.xl, alignItems: "center" },
  travelListFallback: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
    justifyContent: 'center',
  },
  
  // ✅ УЛУЧШЕНИЕ: Стили для страницы ошибки
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xl + DESIGN_TOKENS.spacing.xs,
  },
  errorTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: "600",
    color: colors.text,
    marginTop: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: DESIGN_TOKENS.spacing.xl,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s ease",
        ":hover": {
          backgroundColor: colors.primaryDark,
        } as any,
      },
    }),
  },
  errorButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
  },
});

export const useTravelDetailsStyles = () => {
  const colors = useThemedColors();
  return useMemo(() => getTravelDetailsStyles(colors), [colors]);
};
