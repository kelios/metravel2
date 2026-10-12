// components/home/homeHeroStyles/sliderNavStyles.ts
import { Platform } from 'react-native'

import type { HeroStyleContext } from './context'

export const createSliderNavStyles = (ctx: HeroStyleContext) => {
  const {
    showSideSlider,
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



  } as const
}
