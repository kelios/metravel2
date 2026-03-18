// components/home/homeInspirationStyles.ts
// E4: Styles extracted from HomeInspirationSection.tsx (~450 LOC)

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

export const createSectionStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  section: { gap: isMobile ? 20 : 32 },
  sectionMobile: { gap: 18 },
  sectionFrame: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.xl,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: isMobile ? 20 : 40,
    paddingTop: isMobile ? 28 : 44,
    paddingBottom: isMobile ? 24 : 36,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
        backgroundImage: `linear-gradient(135deg, ${colors.backgroundSecondary} 0%, ${colors.surface} 100%)`,
        transition: 'box-shadow 0.3s ease, transform 0.3s ease',
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
    marginBottom: isMobile ? 16 : 24,
  },
  headerMobile: { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  titleContainer: { flex: 1, gap: 8, minWidth: 0, alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 },
  sectionBadge: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 6,
  },
  sectionBadgeText: { color: colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: {
    fontSize: isMobile ? 28 : 42, fontWeight: '800', color: colors.text,
    lineHeight: isMobile ? 34 : 50, letterSpacing: isMobile ? -0.7 : -1.2,
    textAlign: 'center', maxWidth: 760,
  },
  titleMobile: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  subtitle: { fontSize: isMobile ? 15 : 17, color: colors.textMuted, lineHeight: isMobile ? 23 : 26, textAlign: 'center', maxWidth: 680, letterSpacing: 0.1 },
  subtitleMobile: { fontSize: 15, lineHeight: 22, maxWidth: 440 },
  showcaseSectionFrame: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderLight,
    paddingHorizontal: isMobile ? 16 : 32,
    paddingTop: isMobile ? 24 : 36,
    paddingBottom: isMobile ? 16 : 28,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 16px rgba(15, 23, 42, 0.045)',
        backgroundImage: 'none',
      } as any,
    }),
  },
  showcaseHeader: {
    alignItems: 'center',
    gap: isMobile ? 8 : 12,
    marginBottom: isMobile ? 14 : 20,
  },
  showcaseTitle: {
    fontSize: isMobile ? 26 : 38,
    lineHeight: isMobile ? 32 : 46,
    fontWeight: '800',
    letterSpacing: isMobile ? -0.6 : -1.0,
    textAlign: 'center',
    color: colors.text,
    maxWidth: 760,
  },
  showcaseSubtitle: {
    fontSize: isMobile ? 14 : 16,
    lineHeight: isMobile ? 21 : 24,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 640,
  },
  showcaseBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { boxShadow: `0 1px 5px ${colors.primary}12` } }),
  },
  showcaseBadgeText: {
    color: colors.primaryText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: isMobile ? 30 : 52,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: isMobile ? -0.8 : -1.5,
    lineHeight: isMobile ? 36 : 60,
  },
  heroTitleAccent: {
    fontSize: isMobile ? 30 : 52,
    fontWeight: '800',
    color: colors.brand,
    textAlign: 'center',
    letterSpacing: isMobile ? -0.8 : -1.5,
    lineHeight: isMobile ? 36 : 60,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.primary} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      } as any,
    }),
  },
  heroSubtitle: {
    fontSize: isMobile ? 15 : 18,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: isMobile ? 23 : 28,
    maxWidth: 600,
    alignSelf: 'center',
    letterSpacing: 0.2,
  },
  heroHeader: {
    alignItems: 'center',
    paddingTop: isMobile ? 40 : 64,
    paddingBottom: isMobile ? 28 : 48,
    gap: isMobile ? 10 : 14,
  },
  showcaseGrid: {
    gap: isMobile ? 12 : 14,
  },
  showcaseRow: {
    gap: isMobile ? 12 : 14,
  },
  showcaseCardWrapper: {
    minHeight: isMobile ? 220 : 300,
  },
  trioGrid: {
    gap: isMobile ? 12 : 14,
    width: '100%',
  },
  trioCardTop: {
    width: '100%',
    minHeight: isMobile ? 220 : 360,
  },
  trioBottomRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 12 : 14,
    alignItems: 'stretch',
  },
  trioCardBottom: {
    flex: 1,
    minHeight: isMobile ? 200 : 280,
  },
  bentoGrid: {
    gap: isMobile ? 12 : 14,
    width: '100%',
  },
  bentoRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 12 : 14,
    alignItems: 'stretch',
    width: '100%',
  },
  bentoCardWide: {
    flex: isMobile ? undefined : 2,
    width: isMobile ? '100%' : undefined,
    minHeight: isMobile ? 220 : 340,
  },
  bentoCardNarrow: {
    flex: isMobile ? undefined : 1,
    width: isMobile ? '100%' : undefined,
    minHeight: isMobile ? 200 : 280,
  },
  editorialGrid: {
    width: '100%',
    gap: isMobile ? 12 : 18,
    ...Platform.select({
      web: !isMobile
        ? ({
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            alignItems: 'stretch',
          } as any)
        : null,
    }),
  },
  editorialGridThree: Platform.select({
    web: !isMobile
      ? ({
          gridTemplateRows: 'minmax(320px, auto) minmax(252px, auto)',
        } as any)
      : {},
  }) as any,
  editorialGridFour: Platform.select({
    web: !isMobile
      ? ({
          gridTemplateRows: 'minmax(252px, auto) minmax(252px, auto)',
        } as any)
      : {},
  }) as any,
  editorialCard: {
    minWidth: 0,
    ...Platform.select({
      web: !isMobile
        ? ({
            height: '100%',
          } as any)
        : null,
    }),
  },
  editorialCardHero: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '1 / span 7',
          gridRow: '1 / span 2',
        } as any)
      : {},
  }) as any,
  editorialCardTop: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '8 / span 5',
          gridRow: '1 / span 1',
        } as any)
      : {},
  }) as any,
  editorialCardBottomLeft: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '1 / span 6',
          gridRow: '2 / span 1',
        } as any)
      : {},
  }) as any,
  editorialCardBottomRight: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '7 / span 6',
          gridRow: '2 / span 1',
        } as any)
      : {},
  }) as any,
  editorialCardSideTop: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '8 / span 5',
          gridRow: '1 / span 1',
        } as any)
      : {},
  }) as any,
  editorialCardBottomWideLeft: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '1 / span 6',
          gridRow: '2 / span 1',
        } as any)
      : {},
  }) as any,
  editorialCardBottomWideRight: Platform.select({
    web: !isMobile
      ? ({
          gridColumn: '7 / span 6',
          gridRow: '2 / span 1',
        } as any)
      : {},
  }) as any,
  viewMoreButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: isMobile ? 20 : 28, paddingVertical: isMobile ? 13 : 16,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, flexShrink: 0,
    ...Platform.select({ web: {
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    } }),
  },
  viewMoreButtonMobile: { flexShrink: 0, width: '100%', maxWidth: 320 },
  viewMoreButtonHover: {
    backgroundColor: colors.primarySoft, borderColor: colors.primary,
    ...Platform.select({ web: { transform: 'translateY(-3px) scale(1.02)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } }),
  },
  viewMoreText: { fontSize: isMobile ? 14 : 15, fontWeight: '600', color: colors.text },
  articlesButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: isMobile ? 18 : 26, paddingVertical: isMobile ? 11 : 14,
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 0, backgroundColor: colors.primarySoft, flexShrink: 0,
    ...Platform.select({ web: {
      transition: 'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
    } }),
  },
  articlesButtonHover: {
    backgroundColor: colors.primaryLight,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 6px 18px ${colors.primary}18` } }),
  },
  articlesButtonText: { color: colors.primaryText, fontSize: isMobile ? 14 : 15, lineHeight: isMobile ? 20 : 22, fontWeight: '700' },
  grid: { width: '100%', gap: isMobile ? 12 : 16 },
  row: {
    flexDirection: 'row', gap: isMobile ? 12 : 16, justifyContent: 'flex-start', alignItems: 'stretch', width: '100%',
    ...Platform.select({ web: { justifyContent: 'flex-start' } as any }),
  },
  rowWebCentered: { justifyContent: 'center' },
  cardWrapper: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: isMobile ? 0 : 300,
    ...Platform.select({ web: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch' } as any }),
  },
  cardWrapperSingleColumn: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', alignSelf: 'stretch' },
  cardWrapperMobile: { width: '100%', minWidth: 150 },
  cardWrapperPlaceholder: { opacity: 0, ...Platform.select({ web: { visibility: 'hidden', pointerEvents: 'none' } as any }) },
  emptyState: {
    borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, paddingHorizontal: isMobile ? 24 : 40, paddingVertical: isMobile ? 32 : 48,
    alignItems: 'center', gap: 16,
    ...Platform.select({ web: {
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      backgroundImage: `radial-gradient(ellipse 60% 55% at 50% 110%, ${colors.primarySoft} 0%, transparent 70%)`,
      backgroundRepeat: 'no-repeat',
    } }),
  },
  emptyStateIconWrap: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryAlpha30, marginBottom: 2,
  },
  emptyStateTitle: { color: colors.text, fontSize: isMobile ? 16 : 18, lineHeight: isMobile ? 22 : 25, fontWeight: '700', letterSpacing: -0.2 },
  emptyStateSubtitle: { color: colors.textMuted, fontSize: isMobile ? 13 : 14, lineHeight: isMobile ? 18 : 21 },
});

export const createSectionsStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  band: {
    paddingVertical: isMobile ? 36 : 88, backgroundColor: colors.background, width: '100%', alignSelf: 'stretch',
    ...Platform.select({ web: {
      backgroundImage: [
        `radial-gradient(ellipse 75% 45% at 50% 0%, ${colors.primarySoft} 0%, transparent 58%)`,
        `linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`,
      ].join(', '),
      backgroundRepeat: 'no-repeat',
    } }),
  },
  bandMobile: { paddingVertical: 32 },
  container: { gap: 64, width: '100%', alignSelf: 'stretch' },
  containerMobile: { gap: 28 },

  // ── Outer section card ────────────────────────────────────────────────────
  quickFiltersSection: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    paddingHorizontal: isMobile ? 20 : 48, paddingTop: isMobile ? 28 : 52, paddingBottom: isMobile ? 28 : 52,
    gap: isMobile ? 24 : 40, overflow: 'hidden',
    ...Platform.select({ web: {
      boxShadow: '0 6px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
      backgroundImage: `linear-gradient(145deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
      backgroundRepeat: 'no-repeat',
    } }),
  },

  // ── Decorative background accent blobs ───────────────────────────────────
  quickFiltersAccentBlob1: {
    position: 'absolute', top: -80, right: -60, width: 300, height: 200,
    borderRadius: DESIGN_TOKENS.radii.full, backgroundColor: colors.primarySoft, opacity: 0.38,
    ...Platform.select({ web: { filter: 'blur(52px)', pointerEvents: 'none' } as any }),
  },
  quickFiltersAccentBlob2: {
    position: 'absolute', bottom: -60, left: -40, width: 200, height: 160,
    borderRadius: DESIGN_TOKENS.radii.full, backgroundColor: colors.successSoft, opacity: 0.22,
    ...Platform.select({ web: { filter: 'blur(44px)', pointerEvents: 'none' } as any }),
  },

  // ── Header row ────────────────────────────────────────────────────────────
  quickFiltersHeader: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    justifyContent: 'space-between',
    gap: isMobile ? 16 : 28,
  },
  quickFiltersHeaderLeft: { gap: 10, flex: 1, minWidth: 0 },

  quickFiltersBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primaryAlpha30, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft, paddingHorizontal: 13, paddingVertical: 6,
    ...Platform.select({ web: { boxShadow: `0 1px 6px ${colors.primary}14` } }),
  },
  quickFiltersBadgeText: { color: colors.primaryText, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },

  quickFiltersTitle: {
    color: colors.text,
    fontSize: isMobile ? 26 : 40,
    lineHeight: isMobile ? 32 : 48,
    fontWeight: '800',
    letterSpacing: isMobile ? -0.7 : -1.1,
  },
  quickFiltersSubtitle: { color: colors.textMuted, fontSize: isMobile ? 15 : 16, lineHeight: isMobile ? 23 : 26, maxWidth: 600, letterSpacing: 0.1 },

  quickFiltersArticlesButton: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1.5, borderColor: colors.primaryAlpha40,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: isMobile ? 18 : 22, paddingVertical: isMobile ? 11 : 13,
    flexShrink: 0, alignSelf: isMobile ? 'flex-start' : 'auto',
    ...Platform.select({ web: {
      transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
      whiteSpace: 'nowrap',
    } as any }),
  },
  quickFiltersArticlesButtonHover: {
    backgroundColor: colors.primaryLight, borderColor: colors.primary,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 7px 18px ${colors.primary}1E` } }),
  },
  quickFiltersArticlesText: { color: colors.primaryText, fontSize: 14, lineHeight: 20, fontWeight: '700' },

  // ── Filter cards grid ─────────────────────────────────────────────────────
  quickFiltersGrid: {
    flexDirection: isMobile ? 'column' : 'row',
    flexWrap: isMobile ? 'nowrap' : 'wrap',
    gap: isMobile ? 12 : 14,
  },

  // Each filter group is now a card
  filterGroupCard: {
    borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    paddingHorizontal: isMobile ? 18 : 24, paddingVertical: isMobile ? 16 : 20,
    gap: isMobile ? 12 : 14,
    flexBasis: isMobile ? 'auto' : '47%',
    flexGrow: 1,
    ...Platform.select({ web: {
      boxShadow: '0 3px 14px rgba(0,0,0,0.045), 0 1px 4px rgba(0,0,0,0.03)',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    } as any }),
  },
  filterGroupCardHover: {
    borderColor: colors.primary,
    ...Platform.select({ web: { boxShadow: `0 8px 28px rgba(0,0,0,0.09), 0 3px 8px ${colors.primary}16`, transform: 'translateY(-2px)' } }),
  },

  filterGroupCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterGroupIconWrap: {
    width: 32, height: 32, borderRadius: DESIGN_TOKENS.radii.sm, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: `0 1px 5px ${colors.primary}12` } }),
  },
  filterGroupTitleText: { color: colors.text, fontSize: isMobile ? 14 : 14, fontWeight: '700', letterSpacing: -0.1 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: isMobile ? 7 : 8 },

  chip: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: isMobile ? 14 : 16, paddingVertical: isMobile ? 8 : 9,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    } }),
  },
  chipHover: {
    borderColor: colors.primary, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { transform: 'translateY(-2px) scale(1.02)', boxShadow: `0 4px 12px ${colors.primary}20` } }),
  },
  chipSelected: {
    borderColor: colors.primary, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { boxShadow: `0 3px 10px ${colors.primary}28`, transform: 'scale(1.02)' } }),
  },
  chipText: { color: colors.text, fontSize: isMobile ? 13 : 14, lineHeight: isMobile ? 18 : 20, fontWeight: '500' },
  chipTextSelected: { color: colors.primaryText, fontWeight: '700' },
});
