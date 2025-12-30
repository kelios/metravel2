import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'

export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56

/* -------------------- styles -------------------- */
export const styles = StyleSheet.create({
  // ✅ РЕДИЗАЙН: Светлый современный фон
  wrapper: { 
    flex: 1, 
    backgroundColor: DESIGN_TOKENS.colors.background,
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

  // ✅ РЕДИЗАЙН: Адаптивное боковое меню
  sideMenuBase: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRightWidth: 1,
    borderRightColor: DESIGN_TOKENS.colors.borderLight,
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
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xxl,
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
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.sm + DESIGN_TOKENS.spacing.xs,
    }),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    marginRight: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.light,
    }),
  },
  quickJumpChipPressed: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderColor: DESIGN_TOKENS.colors.borderAccent,
  },
  quickJumpLabel: {
    fontSize: 14,
    fontWeight: "600" as any,
    color: DESIGN_TOKENS.colors.text,
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },
  
  descriptionIntroWrapper: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  
  descriptionIntroTitle: {
    fontSize: Platform.select({ default: 22, web: 24 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  
  descriptionIntroText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 24,
  },

  decisionSummaryBox: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
    padding: Platform.select({ default: DESIGN_TOKENS.spacing.lg, web: DESIGN_TOKENS.spacing.xl }),
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(93, 138, 168, 0.22)',
    backgroundColor: 'rgba(93, 138, 168, 0.06)',
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  decisionSummaryTitle: {
    fontSize: Platform.select({ default: 22, web: 24 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
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
    color: DESIGN_TOKENS.colors.text,
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
    color: DESIGN_TOKENS.colors.text,
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
    backgroundColor: 'rgba(60, 60, 60, 0.06)',
    borderColor: 'rgba(60, 60, 60, 0.14)',
  },
  decisionSummaryBadgePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  decisionSummaryBadgeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.18)',
  },
  decisionSummaryBadgeText: {
    fontSize: 14,
    fontWeight: '800' as any,
    letterSpacing: 0.2,
  },
  decisionSummaryBadgeTextInfo: {
    color: DESIGN_TOKENS.colors.text,
  },
  decisionSummaryBadgeTextPositive: {
    color: '#15803d',
  },
  decisionSummaryBadgeTextNegative: {
    color: '#b91c1c',
  },
  decisionSummaryText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: DESIGN_TOKENS.colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  
  backToTopWrapper: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  
  backToTopText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textMuted,
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
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)" as any,
    // Ensure the sidebar can scroll independently on long menus
    maxHeight: `calc(100vh - ${HEADER_OFFSET_DESKTOP}px)` as any,
    overflowY: "auto" as any,
    overscrollBehavior: "contain" as any,
  },
  sideMenuWebMobile: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DESIGN_TOKENS.colors.surface,
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
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    minHeight: 64,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  sectionHeaderPositive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  sectionHeaderNegative: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderColor: "rgba(248, 113, 113, 0.4)",
  },
  sectionHeaderInfo: {
    backgroundColor: "rgba(96, 165, 250, 0.12)",
    borderColor: "rgba(96, 165, 250, 0.4)",
  },
  sectionHeaderActive: {
    shadowOpacity: 0.10,
    shadowRadius: 10,
    borderColor: DESIGN_TOKENS.colors.primary,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
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
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
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
    color: DESIGN_TOKENS.colors.textMuted,
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    flexShrink: 0,
  },

  sectionHeaderText: { 
    fontSize: Platform.select({
      default: 22,
      web: 26,
    }),
    fontWeight: '700' as any,
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.4,
    lineHeight: Platform.select({
      default: 30,
      web: 34,
    }),
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 14, web: 16 }),
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.sm,
    lineHeight: Platform.select({ default: 22, web: 24 }),
  },
  sliderContainer: {
    width: "100%",
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: "hidden",
    marginBottom: 0,
    backgroundColor: "transparent",
    // Объединенные стили теней
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      },
      default: {
        shadowColor: "rgba(0,0,0,0.12)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },

  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: "hidden",
    backgroundColor: DESIGN_TOKENS.colors.text,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  neutralActionButton: {
    alignSelf: "flex-start",
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  neutralActionButtonPressed: {
    opacity: 0.92,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  neutralActionButtonText: {
    color: DESIGN_TOKENS.colors.text,
    fontSize: 14,
    fontWeight: "600" as any,
  },
  videoHintText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: 14,
    marginTop: DESIGN_TOKENS.spacing.sm,
    textAlign: "center",
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },

  descriptionContainer: {
    width: "100%",
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },

  mobileInsightTabsWrapper: {
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  mobileInsightLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: "#1f2937",
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
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  mobileInsightChipActive: {
    backgroundColor: "#1f2937",
  },
  mobileInsightChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "500",
    color: "#475569",
  },
  mobileInsightChipTextActive: {
    color: "#f8fafc",
  },

  mapEmptyState: {
    width: "100%",
    padding: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
    color: "#475569",
  },
  nearSubtitle: {
    color: "#047857",
  },
  popularSubtitle: {
    color: "#b45309",
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
    backgroundColor: "rgba(16, 185, 129, 0.18)",
  },
  sectionBadgePopular: {
    backgroundColor: "rgba(249, 115, 22, 0.18)",
  },
  sectionBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: "#1f2937",
  },
  sectionBadgeTextNear: {
    color: "#065f46",
  },
  sectionBadgeTextPopular: {
    color: "#9a3412",
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
    backgroundColor: "#f9f8f2",
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xl + DESIGN_TOKENS.spacing.xs,
  },
  errorTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: DESIGN_TOKENS.spacing.xl,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s ease",
        ":hover": {
          backgroundColor: "#ff8c42",
        } as any,
      },
    }),
  },
  errorButtonText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
  },
});
