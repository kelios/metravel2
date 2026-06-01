// components/home/homeHeroStyles/sliderMediaStyles.ts
import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import type { HeroStyleContext } from './context'

export const createSliderMediaStyles = (ctx: HeroStyleContext) => {
  const {
    isMobile,
    showSideSlider,
    sliderHeight,
    hasBookLayout,
    isNarrowDesktopBook,
    sansSerif,
    editorialSerif,
    editorialCaps,
  } = ctx

  return {
    sliderContainer: {
      width: '100%',
      flex: 1,
      minHeight: hasBookLayout ? 0 : sliderHeight,
      borderRadius: isMobile ? 4 : 8,
      overflow: 'hidden',
      backgroundColor: DESIGN_TOKENS.colors.overlay,
      borderWidth: 0,
      ...Platform.select({
        web: showSideSlider
          ? ({
              boxShadow: `
        0 0 0 1px rgba(246,239,227,0.36),
        0 6px 18px rgba(24,17,11,0.14),
        0 1px 4px rgba(24,17,11,0.08),
        inset 0 0 0 1px rgba(248,242,233,0.14)
      `,
              minHeight: 0,
              flexGrow: 1,
              flexShrink: 1,
              transform: 'none',
              transformOrigin: 'center center',
              borderRadius: 6,
              border: '1px solid rgba(247,241,232,0.68)',
              isolation: 'isolate',
            } as any)
          : ({
              boxShadow:
                '0 4px 24px rgba(10,8,6,0.16), 0 1px 4px rgba(10,8,6,0.08)',
              minHeight: hasBookLayout ? 0 : sliderHeight,
              flexGrow: 1,
              flexShrink: 1,
              transform: 'none',
              transformOrigin: 'center center',
            } as any),
      }),
    },
    slideWrapper: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      ...Platform.select({ web: { transition: 'opacity 0.6s ease' } as any }),
    },
    slideImage: {
      width: '100%',
      height: '100%',
      ...Platform.select({
        web: { filter: 'saturate(1.03) contrast(1.01) brightness(0.98)' },
      }),
    },
    sliderPaperInset: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          boxShadow: `
            inset 0 1px 0 rgba(255,248,238,0.38),
            inset 0 0 0 1px rgba(255,247,236,0.1),
            inset 10px 0 14px rgba(255,247,235,0.08),
            inset -8px 0 12px rgba(78,60,40,0.05),
            inset 0 8px 10px rgba(255,248,239,0.04),
            inset 0 -8px 12px rgba(24,17,11,0.05)
          `,
        } as any,
      }),
    },
    sliderPaperFrame: {
      position: 'absolute' as const,
      top: 10,
      left: 10,
      right: 10,
      bottom: 10,
      zIndex: 1,
      borderRadius: isMobile ? 2 : 5,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          border: '1px solid rgba(237,228,214,0.16)',
          boxShadow: 'inset 0 0 0 1px rgba(110,86,58,0.015)',
        } as any,
      }),
    },
    slideOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 3,
      paddingHorizontal: 20,
      paddingTop: 58,
      paddingBottom: 16,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: showSideSlider
          ? {
              backgroundImage:
                'linear-gradient(to top, rgba(26,19,13,0.62) 0%, rgba(26,19,13,0.3) 24%, rgba(26,19,13,0.08) 46%, rgba(26,19,13,0.01) 60%, transparent 100%)',
            }
          : {
              backgroundImage:
                'linear-gradient(to top, rgba(8,6,4,0.92) 0%, rgba(8,6,4,0.5) 50%, transparent 100%)',
            },
      }),
    },
    sliderEdgeBlur: {
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      width: 62,
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: 0,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(0px)',
          WebkitBackdropFilter: 'blur(0px)',
        } as any,
      }),
    },
    sliderEdgeBlurLeft: {
      left: 0,
      ...Platform.select({
        web: {
          backgroundImage: 'none',
        } as any,
      }),
    },
    sliderEdgeBlurRight: {
      right: 0,
      ...Platform.select({
        web: {
          backgroundImage: 'none',
        } as any,
      }),
    },
    sliderTopBlur: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 18,
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: showSideSlider ? 1 : 0,
      ...Platform.select({
        web: {
          backgroundImage: `
            linear-gradient(180deg, rgba(255,249,241,0.14) 0%, rgba(255,247,238,0.025) 42%, rgba(255,247,238,0) 78%),
            linear-gradient(90deg, rgba(112,84,55,0.025) 0%, rgba(255,248,239,0) 12%, rgba(255,248,239,0) 88%, rgba(94,69,45,0.02) 100%)
          `,
        } as any,
      }),
    },
    sliderPageWave: {
      position: 'absolute' as const,
      left: '-1%',
      right: '-1.5%',
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: showSideSlider ? 1 : 0,
      ...Platform.select({
        web: {
          mixBlendMode: 'normal',
        } as any,
      }),
    },
    sliderPageWaveTop: {
      top: -2,
      left: '-0.6%',
      right: '-2.2%',
      height: isNarrowDesktopBook ? 18 : 22,
      ...Platform.select({
        web: {
          backgroundImage: `
          radial-gradient(62% 108% at 18% -52%, rgba(255,250,243,0.24) 0%, rgba(255,248,240,0.08) 18%, rgba(255,248,240,0.015) 34%, rgba(255,248,240,0) 50%),
          radial-gradient(82% 112% at 86% -40%, rgba(255,250,243,0.16) 0%, rgba(255,247,238,0.05) 18%, rgba(255,247,238,0.015) 28%, rgba(255,247,238,0) 42%)
        `,
          filter: 'blur(0.06px)',
          transform: 'skewX(-0.8deg) scaleX(1.008)',
        } as any,
      }),
    },
    sliderPageWaveBottom: {
      bottom: -2,
      left: '-1.8%',
      right: '-0.8%',
      height: isNarrowDesktopBook ? 52 : 62,
      ...Platform.select({
        web: {
          backgroundImage: `
          radial-gradient(78% 124% at 28% 122%, rgba(255,245,233,0.08) 0%, rgba(255,244,232,0.14) 12%, rgba(255,242,229,0.18) 20%, rgba(41,30,20,0.14) 42%, rgba(24,17,11,0.34) 72%, rgba(24,17,11,0) 100%),
          radial-gradient(90% 130% at 92% 124%, rgba(255,245,231,0.05) 0%, rgba(255,243,229,0.08) 11%, rgba(255,241,226,0.12) 18%, rgba(35,26,18,0.12) 38%, rgba(24,17,11,0.24) 68%, rgba(24,17,11,0) 100%),
          linear-gradient(to top, rgba(24,17,11,0.26) 0%, rgba(24,17,11,0.1) 30%, rgba(24,17,11,0.02) 58%, rgba(24,17,11,0) 100%)
        `,
          filter: 'blur(0.1px)',
          transform: 'skewX(1.4deg) scaleX(1.016)',
        } as any,
      }),
    },
    slideEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginBottom: 10,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(252,248,241,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(244,235,221,0.24)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any,
      }),
    },
    slideEyebrowText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '500',
      letterSpacing: 0.45,
      color: 'rgba(247,240,228,0.94)',
      textTransform: 'uppercase' as const,
      ...Platform.select({ web: { fontFamily: editorialCaps } as any }),
    },
    slideCaption: {
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      maxWidth: '90%',
      alignSelf: 'flex-start',
    },
    slideTitle: {
      fontSize: isMobile ? 20 : showSideSlider ? 24 : 26,
      fontWeight: '700',
      color: DESIGN_TOKENS.colors.textOnDark,
      marginBottom: 6,
      letterSpacing: -0.35,
      ...Platform.select({
        web: showSideSlider
          ? {
              fontFamily: editorialSerif,
              textShadow: '0 1px 10px rgba(0,0,0,0.34)',
              lineHeight: '1.25',
              letterSpacing: '-0.015em',
            }
          : ({
              fontFamily: sansSerif,
              textShadow: '0 2px 10px rgba(0,0,0,0.55)',
            } as any),
      }),
    },
    slideSubtitle: {
      fontSize: 12,
      fontWeight: '400',
      color: 'rgba(239,229,214,0.82)',
      letterSpacing: 0.12,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    slideActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 12,
      minHeight: 28,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(252,248,241,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(244,235,221,0.24)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any,
      }),
    },
    slideActionText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: DESIGN_TOKENS.colors.textOnDark,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
  } as const
}
