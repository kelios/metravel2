// components/home/homeHeroStyles.ts
// E3: Styles extracted from HomeHero.tsx (~500 LOC)

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

interface HeroStyleParams {
  colors: Colors;
  isMobile: boolean;
  isSmallPhone: boolean;
  isNarrowLayout: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  showSideSlider: boolean;
  sliderHeight: number;
}

export const createHomeHeroStyles = ({
  colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight,
}: HeroStyleParams) => StyleSheet.create({
  container: {
    width: '100%', paddingTop: isMobile ? 16 : 40, paddingBottom: isMobile ? 24 : 64, backgroundColor: colors.background,
    ...Platform.select({ web: { backgroundImage: [`radial-gradient(ellipse 80% 60% at 50% -5%, ${colors.primarySoft} 0%, transparent 70%)`, `radial-gradient(ellipse 40% 30% at 90% 20%, ${colors.primaryAlpha30} 0%, transparent 60%)`].join(', '), backgroundRepeat: 'no-repeat' } }),
  },
  heroShell: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, borderWidth: 1, borderColor: colors.primaryAlpha30,
    backgroundColor: colors.surface, paddingHorizontal: isMobile ? 10 : 32, paddingVertical: isMobile ? 14 : 32,
    ...Platform.select({ web: { boxShadow: DESIGN_TOKENS.shadows.heavy, backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.primarySoft} 60%, ${colors.backgroundSecondary} 100%)` } }),
  },
  heroRow: {
    flexDirection: showSideSlider ? 'row' : 'column', alignItems: showSideSlider ? 'stretch' : 'stretch',
    justifyContent: showSideSlider ? 'space-between' : 'flex-start', gap: showSideSlider ? 30 : 12, width: '100%',
  },
  heroSection: {
    alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 20,
    width: showSideSlider ? '47%' : '100%', maxWidth: showSideSlider ? 540 : (isMobile ? '100%' : 720),
    flexShrink: 0, paddingHorizontal: isMobile ? 4 : 12, paddingVertical: isMobile ? 8 : 14,
  },
  sliderSection: { flex: 1, minWidth: 0, width: showSideSlider ? '53%' : 320, maxWidth: 600, position: 'relative' as const, justifyContent: 'center' },
  sliderContainer: {
    width: '100%', height: sliderHeight, borderRadius: DESIGN_TOKENS.radii.xl, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    ...Platform.select({ web: { boxShadow: DESIGN_TOKENS.shadows.heavy, backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)` } }),
  },
  slideWrapper: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  slideImage: { width: '100%', height: '100%', ...Platform.select({ web: { filter: 'saturate(1.15) contrast(1.05)' } }) },
  slideOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 18, paddingTop: 40, paddingBottom: 16, pointerEvents: 'none' as const,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(7, 17, 29, 0.88) 0%, rgba(7, 17, 29, 0.52) 52%, rgba(7, 17, 29, 0) 100%)' } }),
  },
  slideCaption: {
    borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: 'rgba(9, 20, 33, 0.42)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)', paddingHorizontal: 12, paddingVertical: 10, maxWidth: '92%', alignSelf: 'flex-start',
    ...Platform.select({ web: { backdropFilter: 'blur(6px)' } }),
  },
  slideTitle: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 4,
    ...(Platform.OS === 'web' ? ({ textShadow: '0px 1px 3px rgba(0,0,0,0.45)' } as any) : { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }),
  },
  slideSubtitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
  sliderNav: {
    position: 'absolute' as const, top: '50%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12,
    ...Platform.select({ web: { transform: 'translateY(-50%)' } }),
  },
  sliderNavBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17, 24, 39, 0.55)', justifyContent: 'center', alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease', backdropFilter: 'blur(8px)' } }),
  },
  sliderNavBtnHover: { backgroundColor: 'rgba(17, 24, 39, 0.8)', ...Platform.select({ web: { transform: 'scale(1.05)' } }) },
  sliderDots: { position: 'absolute' as const, bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 3 },
  sliderDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  sliderDotActive: { backgroundColor: colors.textOnPrimary, borderColor: colors.textOnPrimary },
  slideCounter: {
    position: 'absolute' as const, bottom: 14, right: 14, zIndex: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: 'rgba(9, 20, 33, 0.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({ web: { backdropFilter: 'blur(6px)' } }),
  },
  slideCounterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: {
    fontSize: isSmallPhone ? 26 : isMobile ? 30 : isTablet ? 40 : (isDesktop ? 52 : 46),
    fontWeight: '900', color: colors.text, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 36 : isTablet ? 48 : (isDesktop ? 60 : 54), textAlign: 'left',
  },
  titleAccent: {
    fontSize: isSmallPhone ? 26 : isMobile ? 30 : isTablet ? 40 : (isDesktop ? 52 : 46),
    fontWeight: '900', color: colors.primary, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 36 : isTablet ? 48 : (isDesktop ? 60 : 54), textAlign: 'left',
  },
  subtitle: { fontSize: isMobile ? 15 : 18, fontWeight: '400', color: colors.textMuted, lineHeight: isMobile ? 22 : 28, textAlign: 'left', maxWidth: 520, alignSelf: 'flex-start' },
  highlightsGrid: { flexDirection: isNarrowLayout ? 'column' : 'row', gap: 8, width: '100%', marginTop: 4 },
  highlightCard: {
    flex: isMobile ? undefined : 1, minWidth: 0, borderRadius: DESIGN_TOKENS.radii.md, borderWidth: 1,
    borderColor: colors.primaryAlpha30, backgroundColor: colors.primarySoft, paddingVertical: 10, paddingHorizontal: 12, gap: 5,
    ...Platform.select({ web: { transition: 'all 0.2s ease' } }),
  },
  highlightIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  highlightTitle: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  highlightSubtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  buttonsContainer: {
    flexDirection: isNarrowLayout ? 'column' : 'row', justifyContent: 'flex-start', alignItems: 'center',
    gap: isMobile ? 8 : 12, width: isNarrowLayout ? '100%' : undefined, marginTop: 4,
  },
  primaryButton: {
    paddingHorizontal: isMobile ? 20 : 30, paddingVertical: isMobile ? 13 : 17, minHeight: isMobile ? 46 : 54,
    borderRadius: DESIGN_TOKENS.radii.pill, width: isMobile ? '100%' : undefined,
    ...Platform.select({ web: { transition: 'all 0.2s ease', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  primaryButtonHover: { backgroundColor: colors.primaryDark, ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: DESIGN_TOKENS.shadows.heavy } }) },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.textOnPrimary },
  secondaryButton: {
    paddingHorizontal: isMobile ? 20 : 28, paddingVertical: isMobile ? 13 : 17, minHeight: isMobile ? 46 : 54,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderLight,
    width: isMobile ? '100%' : undefined,
    ...Platform.select({ web: { transition: 'all 0.2s ease' } }),
  },
  secondaryButtonHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha30, ...Platform.select({ web: { transform: 'translateY(-2px)' } }) },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  moodChipsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight, width: '100%' },
  moodChipsScrollContent: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 0,
    justifyContent: showSideSlider ? 'flex-start' : 'center', flexWrap: showSideSlider ? 'wrap' : 'nowrap',
  },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.borderLight,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  moodChipHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha30, ...Platform.select({ web: { transform: 'translateY(-1px)' } }) },
  moodChipIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  moodChipText: { gap: 0 },
  moodChipTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  moodChipMeta: { fontSize: 11, fontWeight: '400', color: colors.textMuted },
  popularSection: { marginTop: isMobile ? 28 : 44, width: '100%' },
  popularTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  popularScrollContent: { flexDirection: 'row', gap: 16, paddingRight: 16 },
  // HERO-01: Featured card на мобайле
  featuredCard: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    marginBottom: 20, position: 'relative' as const,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.22s ease', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  featuredCardHover: { ...Platform.select({ web: { transform: 'translateY(-3px)', boxShadow: DESIGN_TOKENS.shadows.heavy, borderColor: colors.primaryAlpha30 } }) },
  featuredCardImage: { width: '100%', aspectRatio: 16 / 9 },
  featuredCardOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingVertical: 12, paddingTop: 32,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(7,17,29,0.85) 0%, rgba(7,17,29,0.4) 60%, transparent 100%)' } }),
  },
  featuredCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 2 },
  featuredCardSubtitle: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.85)' },
  imageCard: {
    width: isMobile ? 195 : 215, borderRadius: DESIGN_TOKENS.radii.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
    ...Platform.select({ web: { transition: 'all 0.22s ease', cursor: 'pointer', boxShadow: DESIGN_TOKENS.shadows.light } }),
  },
  imageCardHover: { ...Platform.select({ web: { transform: 'translateY(-3px)', boxShadow: DESIGN_TOKENS.shadows.medium, borderColor: colors.primaryAlpha30 } }) },
  imageCardImage: { width: isMobile ? 195 : 215, height: isMobile ? 130 : 148 },
  imageCardContent: { padding: 12, gap: 4 },
  imageCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  imageCardSubtitle: { fontSize: 12, fontWeight: '400', color: colors.textMuted, lineHeight: 16 },
});

