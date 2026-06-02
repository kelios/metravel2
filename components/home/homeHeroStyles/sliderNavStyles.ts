// components/home/homeHeroStyles/sliderNavStyles.ts
import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import type { HeroStyleContext } from './context'

export const createSliderNavStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    showSideSlider,
    sansSerif,
  } = ctx

  return {
    sliderNav: {
      position: 'absolute' as const,
      top: '50%',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      ...Platform.select({
        web: { transform: 'translateY(-50%)', pointerEvents: 'none' },
      }),
    },
    // D-010: transparent 44×44 hit-area wrapper (web only). The actual visible circle
    // is the inner sliderNavBtn View; this outer element just provides the ≥44px tap zone.
    sliderNavBtnHitArea: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: 'transparent' as const,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer', pointerEvents: 'auto' } as any,
      }),
    },
    sliderNavBtn: {
      width: showSideSlider ? 24 : 40,
      height: showSideSlider ? 24 : 40,
      borderRadius: showSideSlider ? 12 : 20,
      backgroundColor: 'rgba(248,241,231,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(248,240,228,0.14)',
      ...Platform.select({
        web: {
          transition:
            'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          pointerEvents: 'none', // presentational only when inside hit-area wrapper
        } as any,
      }),
    },
    sliderNavBtnHover: {
      backgroundColor: 'rgba(248,241,231,0.1)',
      borderColor: 'rgba(248,240,228,0.2)',
      ...Platform.select({ web: { transform: 'scale(1.02)' } as any }),
    },
    sliderDots: {
      position: 'absolute' as const,
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      zIndex: 3,
    },
    sliderDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'all 0.2s ease' },
      }),
    },
    sliderDotActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    slideCounter: {
      position: 'absolute' as const,
      bottom: 16,
      right: 16,
      zIndex: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(20,18,14,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any,
      }),
    },
    slideCounterText: {
      fontSize: 11,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.8)',
      letterSpacing: 0.4,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },

    // -- Slider thumbnails (photo album style) --
    sliderThumbnails: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: 'transparent',
      marginTop: 8,
    },
    sliderThumb: {
      width: 44,
      height: 32,
      borderRadius: 4,
      overflow: 'hidden' as const,
      borderWidth: 2,
      borderColor: 'transparent',
      opacity: 0.55,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        } as any,
      }),
    },
    sliderThumbActive: {
      borderColor: colors.brand,
      opacity: 1,
      ...Platform.select({
        web: {
          transform: 'scale(1.08)',
          boxShadow: `0 2px 8px ${colors.brand}30`,
        } as any,
      }),
    },
    sliderThumbHover: {
      opacity: 0.85,
      ...Platform.select({
        web: {
          transform: 'scale(1.05)',
        } as any,
      }),
    },

    // -- Bookmark ribbon (decorative) --
    bookmarkRibbon: {
      position: 'absolute' as const,
      top: 0,
      right: '18%',
      width: 22,
      height: 38,
      backgroundColor: colors.brand,
      zIndex: 20,
      alignItems: 'center' as const,
      justifyContent: 'flex-start' as const,
      paddingTop: 8,
      ...Platform.select({
        web: {
          clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
          boxShadow: '1px 2px 6px rgba(0,0,0,0.15)',
        } as any,
      }),
    },

    // -- Page curl effect --
    pageCurlCorner: {
      position: 'absolute' as const,
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      zIndex: 10,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(135deg, 
        transparent 50%, 
        rgba(220,210,190,0.4) 50%, 
        rgba(245,240,232,0.7) 100%
      )`,
          boxShadow: '-1px -1px 3px rgba(0,0,0,0.04)',
        } as any,
      }),
    },
  } as const
}
