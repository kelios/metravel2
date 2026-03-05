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
    paddingVertical: isMobile ? 32 : 72, backgroundColor: colors.background, width: '100%', alignSelf: 'stretch',
    ...Platform.select({ web: { backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, ${colors.primarySoft} 0%, transparent 60%), linear-gradient(180deg, ${colors.backgroundSecondary} 0%, ${colors.background} 100%)`, backgroundRepeat: 'no-repeat' } }),
  },
  bandMobile: { paddingVertical: 28 },
  container: { gap: 56, width: '100%', alignSelf: 'stretch' },
  containerMobile: { gap: 24 },
  quickFiltersSection: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, padding: isMobile ? 16 : 36, gap: isMobile ? 16 : 28,
    ...Platform.select({ web: { boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)', backgroundImage: `linear-gradient(165deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`, backgroundRepeat: 'no-repeat' } }),
  },
  quickFiltersHeader: { gap: 14 },
  quickFiltersBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.primaryAlpha30, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft, paddingHorizontal: 14, paddingVertical: 7,
    ...Platform.select({ web: { boxShadow: `0 2px 8px ${colors.primary}15` } }),
  },
  quickFiltersBadgeText: { color: colors.primaryText, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  quickFiltersTitle: { color: colors.text, fontSize: isMobile ? 22 : 34, lineHeight: isMobile ? 28 : 42, fontWeight: '800', letterSpacing: -0.6 },
  quickFiltersSubtitle: { color: colors.textMuted, fontSize: isMobile ? 14 : 16, lineHeight: isMobile ? 21 : 25, maxWidth: 680 },
  quickFiltersLinks: { marginTop: 12, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 16 },
  quickFiltersHint: { color: colors.textMuted, fontSize: 14, lineHeight: 21, flexShrink: 1, maxWidth: 620 },
  quickFiltersArticlesButton: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.surface, paddingHorizontal: 22, paddingVertical: 13,
    ...Platform.select({ web: { transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)' } }),
  },
  quickFiltersArticlesButtonHover: {
    backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha40,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' } }),
  },
  quickFiltersArticlesText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  quickFiltersGroups: { gap: 10 },
  filterGroupRow: {
    flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 14 : 16,
    borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 0,
    backgroundColor: 'transparent', paddingHorizontal: isMobile ? 4 : 8, paddingVertical: isMobile ? 12 : 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  filterGroupTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: isMobile ? 0 : 190 },
  filterGroupIconWrap: {
    width: 36, height: 36, borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: `0 2px 6px ${colors.primary}12` } }),
  },
  filterGroupTitleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chipsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease-out', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } }),
  },
  chipHover: {
    borderColor: colors.primary, backgroundColor: colors.primarySoft,
    ...Platform.select({ web: { transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${colors.primary}18` } }),
  },
  chipText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});

