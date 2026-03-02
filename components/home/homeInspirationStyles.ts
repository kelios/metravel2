// components/home/homeInspirationStyles.ts
// E4: Styles extracted from HomeInspirationSection.tsx (~450 LOC)

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

export const createSectionStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  section: { gap: 24 },
  sectionMobile: { gap: 12 },
  sectionFrame: {
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: DESIGN_TOKENS.radii.xl,
    backgroundColor: colors.surface, padding: isMobile ? 10 : 28,
    ...Platform.select({ web: { boxShadow: DESIGN_TOKENS.shadows.medium, backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`, backgroundRepeat: 'no-repeat', backdropFilter: 'blur(12px)' } as any }),
  },
  sectionGlow: {
    position: 'absolute', top: -60, right: -80, width: 240, height: 160,
    borderRadius: DESIGN_TOKENS.radii.full, backgroundColor: colors.primarySoft, opacity: 0.6,
    ...Platform.select({ web: { filter: 'blur(40px)' } }),
  },
  sectionAccent: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 4,
    backgroundColor: colors.primaryAlpha50, borderTopLeftRadius: DESIGN_TOKENS.radii.xl, borderTopRightRadius: DESIGN_TOKENS.radii.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
  headerMobile: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 12 },
  titleContainer: { flex: 1, gap: 12, minWidth: 0 },
  headerActions: { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 12, flexShrink: 0 },
  sectionBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primaryAlpha30, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6,
  },
  sectionBadgeText: { color: colors.primaryText, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 32, fontWeight: '900', color: colors.text, lineHeight: 40, letterSpacing: -0.8 },
  titleMobile: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  subtitle: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
  subtitleMobile: { fontSize: 14, lineHeight: 20 },
  viewMoreButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: isMobile ? 16 : 24, paddingVertical: isMobile ? 10 : 14,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderLight, flexShrink: 0,
    ...Platform.select({ web: { transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  viewMoreButtonMobile: { flexShrink: 0, width: '100%' },
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
  grid: { width: '100%', gap: isMobile ? 14 : 18, ...Platform.select({ web: { touchAction: 'pan-y' } as any }) },
  row: {
    flexDirection: 'row', gap: isMobile ? 14 : 18, justifyContent: 'flex-start', alignItems: 'stretch', width: '100%',
    ...Platform.select({ web: { justifyContent: 'flex-start', touchAction: 'pan-y' } as any }),
  },
  rowWebCentered: { justifyContent: 'center' },
  cardWrapper: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: isMobile ? 0 : 360,
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
    paddingVertical: 64, backgroundColor: colors.backgroundSecondary, width: '100%', alignSelf: 'stretch',
    ...Platform.select({ web: { backgroundImage: `radial-gradient(ellipse 92% 72% at 50% -2%, ${colors.primarySoft} 0%, transparent 72%), linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`, backgroundRepeat: 'no-repeat' } }),
  },
  bandMobile: { paddingVertical: 24 },
  container: { gap: 52, width: '100%', alignSelf: 'stretch' },
  containerMobile: { gap: 20 },
  quickFiltersSection: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, padding: isMobile ? 10 : 32, gap: isMobile ? 12 : 24,
    ...Platform.select({ web: { boxShadow: DESIGN_TOKENS.shadows.medium, backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`, backgroundRepeat: 'no-repeat', backdropFilter: 'blur(12px)' } }),
  },
  quickFiltersHeader: { gap: 12 },
  quickFiltersBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.primaryAlpha30, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6,
  },
  quickFiltersBadgeText: { color: colors.primaryText, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  quickFiltersTitle: { color: colors.text, fontSize: isMobile ? 20 : 32, lineHeight: isMobile ? 26 : 40, fontWeight: '900', letterSpacing: -0.8 },
  quickFiltersSubtitle: { color: colors.textMuted, fontSize: isMobile ? 14 : 16, lineHeight: isMobile ? 20 : 24 },
  quickFiltersLinks: { marginTop: 8, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 16 },
  quickFiltersHint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, flexShrink: 1, maxWidth: 620 },
  quickFiltersArticlesButton: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 0, backgroundColor: colors.primarySoft, paddingHorizontal: 20, paddingVertical: 12,
    ...Platform.select({ web: { transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  quickFiltersArticlesButtonHover: {
    backgroundColor: colors.primaryLight,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  quickFiltersArticlesText: { color: colors.primaryText, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  quickFiltersGroups: { gap: 12 },
  filterGroupRow: {
    flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 12,
    borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, paddingHorizontal: isMobile ? 16 : 20, paddingVertical: isMobile ? 14 : 16,
  },
  filterGroupTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: isMobile ? 0 : 180 },
  filterGroupIconWrap: {
    width: 32, height: 32, borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center',
  },
  filterGroupTitleText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  chipsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  chipHover: {
    borderColor: colors.primaryAlpha40, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: DESIGN_TOKENS.shadows.light } }),
  },
  chipText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});

