// components/home/homeInspirationStyles.ts
// E4: Styles extracted from HomeInspirationSection.tsx (~450 LOC)

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

export const createSectionStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  section: { gap: isMobile ? 14 : 24 },
  sectionMobile: { gap: 12 },
  sectionFrame: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.xl,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: isMobile ? 14 : 28,
    paddingTop: isMobile ? 20 : 32,
    paddingBottom: isMobile ? 14 : 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 14px rgba(15, 23, 42, 0.04)',
        backgroundImage: 'none',
      } as any,
    }),
  },
  sectionGlow: {
    display: 'none',
  } as any,
  sectionAccent: {
    display: 'none',
  } as any,
  header: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: isMobile ? 8 : 12,
    marginBottom: isMobile ? 14 : 20,
  },
  headerMobile: { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  titleContainer: { flex: 1, gap: 8, minWidth: 0, alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 },
  sectionBadge: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6,
  },
  sectionBadgeText: { color: colors.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: isMobile ? 26 : 38, fontWeight: '900', color: colors.text, lineHeight: isMobile ? 32 : 46, letterSpacing: isMobile ? -0.5 : -0.9, textAlign: 'center', maxWidth: 760 },
  titleMobile: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  subtitle: { fontSize: isMobile ? 14 : 17, color: colors.textMuted, lineHeight: isMobile ? 20 : 25, textAlign: 'center', maxWidth: 680 },
  subtitleMobile: { fontSize: 14, lineHeight: 20, maxWidth: 420 },
  showcaseSectionFrame: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderLight,
    paddingHorizontal: isMobile ? 14 : 28,
    paddingTop: isMobile ? 20 : 32,
    paddingBottom: isMobile ? 14 : 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 14px rgba(15, 23, 42, 0.04)',
        backgroundImage: 'none',
      } as any,
    }),
  },
  showcaseHeader: {
    alignItems: 'center',
    gap: isMobile ? 8 : 10,
    marginBottom: isMobile ? 12 : 18,
  },
  showcaseTitle: {
    fontSize: isMobile ? 26 : 38,
    lineHeight: isMobile ? 32 : 46,
    fontWeight: '900',
    letterSpacing: isMobile ? -0.5 : -0.9,
    textAlign: 'center',
    color: colors.text,
    maxWidth: 760,
  },
  showcaseSubtitle: {
    fontSize: isMobile ? 14 : 17,
    lineHeight: isMobile ? 20 : 25,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 680,
  },
  showcaseBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  showcaseBadgeText: {
    color: colors.primaryText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: isMobile ? 28 : 48,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -1.2,
    lineHeight: isMobile ? 34 : 56,
  },
  heroTitleAccent: {
    fontSize: isMobile ? 28 : 48,
    fontWeight: '900',
    color: colors.brand,
    textAlign: 'center',
    letterSpacing: -1.2,
    lineHeight: isMobile ? 34 : 56,
  },
  heroSubtitle: {
    fontSize: isMobile ? 15 : 18,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: isMobile ? 22 : 28,
    maxWidth: 560,
    alignSelf: 'center',
  },
  heroHeader: {
    alignItems: 'center',
    paddingTop: isMobile ? 40 : 64,
    paddingBottom: isMobile ? 28 : 48,
    gap: isMobile ? 10 : 12,
  },
  showcaseGrid: {
    gap: isMobile ? 10 : 12,
  },
  showcaseRow: {
    gap: isMobile ? 10 : 12,
  },
  showcaseCardWrapper: {
    minHeight: isMobile ? 220 : 300,
  },
  trioGrid: {
    gap: isMobile ? 10 : 12,
    width: '100%',
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  trioCardTop: {
    width: '100%',
    minHeight: isMobile ? 220 : 360,
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  trioBottomRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 10 : 12,
    alignItems: 'stretch',
  },
  trioCardBottom: {
    flex: 1,
    minHeight: isMobile ? 200 : 280,
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  bentoGrid: {
    gap: isMobile ? 10 : 12,
    width: '100%',
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  bentoRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 10 : 12,
    alignItems: 'stretch',
    width: '100%',
  },
  bentoCardWide: {
    flex: isMobile ? undefined : 2,
    width: isMobile ? '100%' : undefined,
    minHeight: isMobile ? 220 : 340,
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  bentoCardNarrow: {
    flex: isMobile ? undefined : 1,
    width: isMobile ? '100%' : undefined,
    minHeight: isMobile ? 200 : 280,
    ...Platform.select({ web: { touchAction: 'pan-y' } as any }),
  },
  viewMoreButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: isMobile ? 16 : 22, paddingVertical: isMobile ? 10 : 13,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderLight, flexShrink: 0,
    ...Platform.select({ web: { transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  viewMoreButtonMobile: { flexShrink: 0, width: '100%', maxWidth: 300 },
  viewMoreButtonHover: {
    backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha30,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  viewMoreText: { fontSize: isMobile ? 14 : 16, fontWeight: '700', color: colors.text },
  articlesButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: isMobile ? 16 : 24, paddingVertical: isMobile ? 10 : 14,
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 0, backgroundColor: colors.primarySoft, flexShrink: 0,
    ...Platform.select({ web: { transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  articlesButtonHover: {
    backgroundColor: colors.primaryLight,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  articlesButtonText: { color: colors.primaryText, fontSize: isMobile ? 14 : 16, lineHeight: isMobile ? 20 : 22, fontWeight: '800' },
  grid: { width: '100%', gap: isMobile ? 12 : 16, ...Platform.select({ web: { touchAction: 'pan-y' } as any }) },
  row: {
    flexDirection: 'row', gap: isMobile ? 12 : 16, justifyContent: 'flex-start', alignItems: 'stretch', width: '100%',
    ...Platform.select({ web: { justifyContent: 'flex-start', touchAction: 'pan-y' } as any }),
  },
  rowWebCentered: { justifyContent: 'center' },
  cardWrapper: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: isMobile ? 0 : 300,
    ...Platform.select({ web: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch', touchAction: 'pan-y' } as any }),
  },
  cardWrapperSingleColumn: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', alignSelf: 'stretch' },
  cardWrapperMobile: { width: '100%', minWidth: 150 },
  cardWrapperPlaceholder: { opacity: 0, ...Platform.select({ web: { visibility: 'hidden', pointerEvents: 'none' } as any }) },
  emptyState: {
    borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 1, borderColor: colors.primaryAlpha30,
    backgroundColor: colors.surface, paddingHorizontal: isMobile ? 20 : 28, paddingVertical: isMobile ? 24 : 32,
    alignItems: 'center', gap: 12,
    ...Platform.select({ web: { boxShadow: DESIGN_TOKENS.shadows.light, backgroundImage: `radial-gradient(ellipse 60% 60% at 50% 100%, ${colors.primarySoft} 0%, transparent 70%)`, backgroundRepeat: 'no-repeat' } }),
  },
  emptyStateIconWrap: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryAlpha30, marginBottom: 4,
  },
  emptyStateTitle: { color: colors.text, fontSize: isMobile ? 16 : 18, lineHeight: isMobile ? 22 : 24, fontWeight: '800', letterSpacing: -0.2 },
  emptyStateSubtitle: { color: colors.textMuted, fontSize: isMobile ? 13 : 14, lineHeight: isMobile ? 18 : 20 },
});

export const createSectionsStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  band: {
    paddingVertical: isMobile ? 32 : 80, backgroundColor: colors.background, width: '100%', alignSelf: 'stretch',
    ...Platform.select({ web: { backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, ${colors.primarySoft} 0%, transparent 60%), linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`, backgroundRepeat: 'no-repeat' } }),
  },
  bandMobile: { paddingVertical: 28 },
  container: { gap: 56, width: '100%', alignSelf: 'stretch' },
  containerMobile: { gap: 24 },

  // ── Outer section card ────────────────────────────────────────────────────
  quickFiltersSection: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, paddingHorizontal: isMobile ? 16 : 40, paddingTop: isMobile ? 20 : 40, paddingBottom: isMobile ? 20 : 40,
    gap: isMobile ? 20 : 32, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 4px 32px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)', backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`, backgroundRepeat: 'no-repeat' } }),
  },

  // ── Decorative background accent blobs ───────────────────────────────────
  quickFiltersAccentBlob1: {
    position: 'absolute', top: -80, right: -60, width: 320, height: 220,
    borderRadius: DESIGN_TOKENS.radii.full, backgroundColor: colors.primarySoft, opacity: 0.45,
    ...Platform.select({ web: { filter: 'blur(56px)', pointerEvents: 'none' } as any }),
  },
  quickFiltersAccentBlob2: {
    position: 'absolute', bottom: -60, left: -40, width: 220, height: 180,
    borderRadius: DESIGN_TOKENS.radii.full, backgroundColor: colors.successSoft, opacity: 0.3,
    ...Platform.select({ web: { filter: 'blur(48px)', pointerEvents: 'none' } as any }),
  },

  // ── Header row ────────────────────────────────────────────────────────────
  quickFiltersHeader: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    justifyContent: 'space-between',
    gap: isMobile ? 16 : 24,
  },
  quickFiltersHeaderLeft: { gap: 10, flex: 1, minWidth: 0 },

  quickFiltersBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.primaryAlpha30, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft, paddingHorizontal: 13, paddingVertical: 6,
    ...Platform.select({ web: { boxShadow: `0 2px 10px ${colors.primary}18` } }),
  },
  quickFiltersBadgeText: { color: colors.primaryText, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },

  quickFiltersTitle: { color: colors.text, fontSize: isMobile ? 24 : 36, lineHeight: isMobile ? 30 : 44, fontWeight: '800', letterSpacing: isMobile ? -0.5 : -0.8 },
  quickFiltersSubtitle: { color: colors.textMuted, fontSize: isMobile ? 14 : 15, lineHeight: isMobile ? 21 : 24, maxWidth: 560 },

  quickFiltersArticlesButton: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1.5, borderColor: colors.primaryAlpha40,
    backgroundColor: colors.primarySoft, paddingHorizontal: isMobile ? 18 : 22, paddingVertical: isMobile ? 11 : 13,
    flexShrink: 0, alignSelf: isMobile ? 'flex-start' : 'auto',
    ...Platform.select({ web: { transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)', whiteSpace: 'nowrap' } as any }),
  },
  quickFiltersArticlesButtonHover: {
    backgroundColor: colors.primaryLight, borderColor: colors.primary,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 8px 20px ${colors.primary}22` } }),
  },
  quickFiltersArticlesText: { color: colors.primaryText, fontSize: 14, lineHeight: 20, fontWeight: '700' },

  // ── Filter cards grid ─────────────────────────────────────────────────────
  quickFiltersGrid: {
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: isMobile ? 'nowrap' : 'wrap',
    gap: isMobile ? 10 : 12,
  },

  // Each filter group is now a card
  filterGroupCard: {
    borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    paddingHorizontal: isMobile ? 14 : 18, paddingVertical: isMobile ? 14 : 16,
    gap: isMobile ? 10 : 12,
    // On desktop: 2 cards per row, the distance group can span wider
    flexBasis: isMobile ? 'auto' : '47%',
    flexGrow: 1,
    ...Platform.select({ web: { boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)', transition: 'box-shadow 0.2s ease, border-color 0.2s ease' } as any }),
  },
  filterGroupCardHover: {
    borderColor: colors.primaryAlpha30,
    ...Platform.select({ web: { boxShadow: `0 6px 24px rgba(0,0,0,0.08), 0 2px 6px ${colors.primary}10` } }),
  },

  filterGroupCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterGroupIconWrap: {
    width: 34, height: 34, borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: `0 2px 6px ${colors.primary}14` } }),
  },
  filterGroupTitleText: { color: colors.text, fontSize: isMobile ? 14 : 15, fontWeight: '700', letterSpacing: -0.1 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: isMobile ? 7 : 8 },

  chip: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary, paddingHorizontal: isMobile ? 13 : 15, paddingVertical: isMobile ? 7 : 8,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.18s ease-out', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } }),
  },
  chipHover: {
    borderColor: colors.primaryAlpha40, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 4px 14px ${colors.primary}1A` } }),
  },
  chipSelected: {
    borderColor: colors.primary, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { boxShadow: `0 2px 10px ${colors.primary}28` } }),
  },
  chipText: { color: colors.text, fontSize: isMobile ? 13 : 14, lineHeight: isMobile ? 18 : 20, fontWeight: '500' },
  chipTextSelected: { color: colors.primaryText, fontWeight: '700' },
});

