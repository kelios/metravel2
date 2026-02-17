import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56

/* P1-7: Увеличенные отступы — возвращаем воздух после чрезмерного сжатия */
export const COMPACT_SPACING = {
  hero: {
    mobile: 20, // было 18, оригинал 24
    desktop: 28, // было 24, оригинал 32
  },
  section: {
    mobile: 18, // было 14, оригинал 18-20
    desktop: 24, // было 18, оригинал 24
  },
  card: {
    mobile: 14, // было 12, оригинал 16
    desktop: 16, // было 14, оригинал 18
  },
  margin: {
    section: 18, // было 14, оригинал 18
    card: 10, // было 9, оригинал 12
  },
} as const;

export const COMPACT_TYPOGRAPHY = {
  title: {
    mobile: 22, // было 20, оригинал 24
    desktop: 24, // было 22, оригинал 26-28
  },
  subtitle: {
    mobile: 17, // было 16, оригинал 18-20
    desktop: 19, // было 18, оригинал 20-22
  },
  body: {
    mobile: 14, // без изменений
    desktop: 15, // было 14, оригинал 16
  },
  caption: {
    mobile: 12, // без изменений
    desktop: 13, // без изменений
  },
} as const;

/* -------------------- helpers -------------------- */
const _getShadowStyle = (colors: ThemedColors, shadowType: 'light' | 'medium' = 'light') => {
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
      default: COMPACT_SPACING.section.desktop + 8, // 32px — больше воздуха между секциями
      web: COMPACT_SPACING.section.desktop + 16, // 40px — заметное разделение секций
    }),
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
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },

  quickJumpWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: DESIGN_TOKENS.spacing.xs,
    gap: 0,
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
    paddingVertical: 8,
    paddingHorizontal: Platform.select({
      default: 14,
      web: 16,
    }),
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 0,
    backgroundColor: colors.backgroundSecondary,
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    gap: 6,
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.2s ease, color 0.2s ease',
      cursor: 'pointer',
    } as any : {}),
  },
  quickJumpChipPressed: {
    backgroundColor: colors.primarySoft,
  },
  quickJumpLabel: {
    fontSize: 13,
    fontWeight: "500" as any,
    color: colors.textMuted,
    letterSpacing: 0,
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
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary,
    ...(Platform.OS === 'web' ? {
      transition: 'border-color 0.2s ease',
    } as any : {}),
  },
  decisionSummaryTitle: {
    fontSize: Platform.select({ default: 20, web: 22 }),
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
    overflowY: "auto" as any,
    overflowX: "hidden" as any,
    overscrollBehavior: "contain" as any,
    display: "flex" as any,
    flexDirection: "column" as any,
    minHeight: 0 as any,
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
      default: 14,
      web: 16,
    }),
    paddingHorizontal: Platform.select({
      default: 16,
      web: 20,
    }),
    backgroundColor: 'transparent',
    borderRadius: DESIGN_TOKENS.radii.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 52,
    ...(Platform.OS === 'web' ? {
      transition: 'background-color 0.2s ease, border-color 0.2s ease',
      cursor: 'pointer',
    } as any : {}),
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
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  sectionHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 1,
    flexGrow: 1,
  },
  
  sectionHeaderIcon: {
    width: Platform.select({ default: 28, web: 30 }),
    height: Platform.select({ default: 28, web: 30 }),
    borderRadius: Platform.select({ default: 8, web: 8 }),
    backgroundColor: 'transparent',
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
    fontSize: 12,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    flexShrink: 0,
  },

  sectionHeaderText: { 
    fontSize: Platform.select({
      default: 18,
      web: 20,
    }),
    fontWeight: '600' as any,
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: Platform.select({
      default: 24,
      web: 26,
    }),
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 13, web: 14 }),
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.xs,
    lineHeight: Platform.select({ default: 20, web: 22 }),
  },
  sliderContainer: {
    width: "100%",
    borderRadius: DESIGN_TOKENS.radii.xl,
    overflow: "hidden",
    marginBottom: 0,
    backgroundColor: "transparent",
    position: "relative" as any,
  },

  heroOverlay: {
    position: "absolute" as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: Platform.select({ default: 16, web: 28 }),
    paddingBottom: Platform.select({ default: 52, web: 56 }),
    paddingTop: Platform.select({ default: 100, web: 140 }),
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)',
    } as any : {}),
  },
  heroTitle: {
    fontSize: Platform.select({ default: 24, web: 32 }),
    fontWeight: "700" as any,
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: Platform.select({ default: 30, web: 40 }),
    ...(Platform.OS === 'web' ? {
      textShadow: '0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)',
    } as any : {
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    }),
  },
  heroMeta: {
    fontSize: Platform.select({ default: 14, web: 16 }),
    fontWeight: "500" as any,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    letterSpacing: 0.3,
    ...(Platform.OS === 'web' ? {
      textShadow: '0 1px 6px rgba(0,0,0,0.4)',
    } as any : {
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    }),
  },
  heroFavoriteBtn: {
    position: "absolute" as any,
    top: Platform.select({ default: 12, web: 16 }),
    right: Platform.select({ default: 12, web: 16 }),
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: "center" as any,
    justifyContent: "center" as any,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  heroFavoriteBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 12px rgba(255,107,0,0.4)',
    } as any : {}),
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: Platform.select({
      default: 0,
      web: 0,
    }),
    paddingTop: Platform.select({
      default: 4,
      web: 8,
    }),
    borderWidth: 0,
    borderColor: 'transparent',
  },

  mobileInsightTabsWrapper: {
    backgroundColor: 'transparent',
    padding: 0,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mobileInsightLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  mobileInsightTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 4,
  },
  mobileInsightChip: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 6,
  },
  mobileInsightChipActive: {
    borderBottomColor: colors.primary,
  },
  mobileInsightChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
  mobileInsightChipTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  mobileInsightChipBadge: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden" as const,
  },
  mobileInsightChipBadgeActive: {
    color: colors.text,
    backgroundColor: colors.primarySoft,
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
      },
    }),
  },
  errorButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
  },

  // 5.5: Стили для состояния загрузки (skeleton)
  loadingSkeletonWrap: {
    width: '100%' as any,
  },
  loadingSkeletonHero: {
    height: 260,
    margin: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingSkeletonContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  loadingSkeletonSpacer: {
    height: DESIGN_TOKENS.spacing.md,
  },
});

export const useTravelDetailsStyles = () => {
  const colors = useThemedColors();
  return useMemo(() => getTravelDetailsStyles(colors), [colors]);
};
