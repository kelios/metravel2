// components/home/homeHeroStyles/sliderSectionStyles.ts
import { Platform } from 'react-native'

import type { HeroStyleContext } from './context'

export const createSliderSectionStyles = (ctx: HeroStyleContext) => {
  const {
    isMobile,
    showSideSlider,
    sliderHeight,
    isUltraWideBook,
    isLargeDesktopBook,
    isNarrowDesktopBook,
    rightPageWidth,
    serif,
  } = ctx

  return {
    sliderSection: {
      flex: showSideSlider ? 1 : 0,
      flexGrow: showSideSlider ? 1 : 0,
      flexShrink: 1,
      minWidth: 0,
      width: rightPageWidth,
      maxWidth: showSideSlider ? rightPageWidth : 600,
      position: 'relative' as const,
      alignSelf: 'stretch',
      minHeight: showSideSlider ? 0 : sliderHeight + (isMobile ? 40 : 64),
      ...Platform.select({
        web: showSideSlider
          ? ({
              backgroundColor: 'transparent',
              borderRadius: 0,
              paddingTop: isUltraWideBook
                ? '8.4%'
                : isLargeDesktopBook
                  ? '8.8%'
                  : '9.3%',
              paddingBottom: isUltraWideBook
                ? '13.8%'
                : isLargeDesktopBook
                  ? '14.4%'
                  : '14.8%',
              paddingLeft: isUltraWideBook
                ? '2.8%'
                : isNarrowDesktopBook
                  ? '2.6%'
                  : '3.2%',
              paddingRight: isUltraWideBook
                ? '15.2%'
                : isNarrowDesktopBook
                  ? '17.2%'
                  : '16.2%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              boxSizing: 'border-box',
              overflow: 'hidden',
            } as any)
          : {},
      }),
    },
    sliderFrame: {
      width: '100%',
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
      position: 'relative' as const,
      overflow: 'hidden',
      borderRadius: isNarrowDesktopBook ? 12 : 10,
      ...Platform.select({
        web: {
          alignSelf: 'stretch',
          height: isNarrowDesktopBook ? '90%' : '92%',
          marginTop: 0,
          clipPath: `inset(0 round ${isNarrowDesktopBook ? 12 : 10}px)`,
          boxSizing: 'border-box',
        } as any,
      }),
    },
    sliderPageGoldLine: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 5,
      borderWidth: 0,
      ...Platform.select({
        web: {
          display: 'none',
        } as any,
      }),
    },
    heroPageCurlRight: {
      position: 'absolute' as const,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      zIndex: 3,
    },
    sliderPageNumber: {
      position: 'absolute' as const,
      bottom: isMobile ? 10 : 14,
      right: isMobile ? 14 : 20,
      fontSize: isMobile ? 10 : 11,
      fontWeight: '400',
      letterSpacing: 0.4,
      color: 'rgba(140,110,60,0.3)',
      zIndex: 5,
      ...Platform.select({
        web: {
          fontFamily: serif,
          fontStyle: 'italic',
        } as any,
      }),
    },
  } as const
}
