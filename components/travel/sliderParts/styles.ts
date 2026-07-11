import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const DOT_SIZE = 6;
const DOT_ACTIVE_SIZE = 8;
/** Max visible dots in the Instagram-style sliding window */
export const MAX_VISIBLE_DOTS = 5;

export const createSliderStyles = (colors: Record<string, any>) =>
  StyleSheet.create<Record<string, any>>({
    sliderStack: {
      width: '100%',
      alignItems: 'center',
    },
    wrapper: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor: 'transparent',
      position: 'relative',
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    wrapperMobile: {
      borderRadius: DESIGN_TOKENS.radii.md,
      marginVertical: 8,
    },
    wrapperTablet: {
      borderRadius: DESIGN_TOKENS.radii.md,
      marginVertical: 8,
    },
    clip: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    clipMobile: {
      borderRadius: DESIGN_TOKENS.radii.md,
    },
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web' ? ({
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as any) : {}),
    },
    scrollSnap: Platform.OS === 'web'
      ? ({
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
          touchAction: 'pan-x pan-y',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          WebkitScrollSnapPointsX: 'repeat(100%)',
        } as any)
      : {},
    scrollContent: {
      flexDirection: 'row',
    },
    carouselViewport: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select<any>({
        web: {
          userSelect: 'none',
        },
        default: {},
      }),
    },
    carouselTrack: {
      flexDirection: 'row',
      height: '100%',
    },
    slide: {
      flexShrink: 0,
      position: 'relative',
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    slideSnap: Platform.OS === 'web'
      ? ({ 
          scrollSnapAlign: 'start', 
          scrollSnapStop: 'always',
          WebkitScrollSnapCoordinate: '0 0',
        } as any)
      : {},
    blurBg: {
      ...StyleSheet.absoluteFillObject,
    },
    img: {
      width: '100%',
      height: '100%',
      borderRadius: 0,
    },
    neutralPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 0,
      backgroundColor: colors.backgroundSecondary,
    },
    captionContainer: {
      position: 'absolute',
      left: DESIGN_TOKENS.spacing.md,
      right: DESIGN_TOKENS.spacing.md,
      bottom: 44,
      zIndex: DESIGN_TOKENS.zIndex.fixed,
      alignItems: 'center',
      pointerEvents: 'none',
    },
    captionText: {
      maxWidth: 720,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      backgroundColor: colors.overlay,
      color: colors.textOnDark,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 22,
      letterSpacing: -0.1,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows?.medium,
          backdropFilter: 'blur(16px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.25)',
        },
        default: {
          shadowColor: colors.text,
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
      }),
    },
    navBtn: {
      position: 'absolute',
      top: '50%',
      marginTop: -18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      width: 44,
      height: 44,
      borderRadius: 22,
      zIndex: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select<any>({
        web: {
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          contain: 'layout',
          opacity: 0,
        },
      }),
    },
    navBtnDesktop: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginTop: -22,
    },
    navBtnMobile: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginTop: -22,
    },
    navBtnTablet: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginTop: -22,
    },
    navBtnHover: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    arrowIconContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowIcon: {
      opacity: 0.95,
    },
    dots: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: DESIGN_TOKENS.zIndex.fixed,
    },
    dotsMobile: {
      bottom: 10,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 16,
      ...Platform.select({
        web: {
          overflow: 'hidden',
        },
      }),
    },
    dotWrap: {
      paddingHorizontal: 1,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    dot: {
      backgroundColor: 'rgba(255,255,255,0.4)',
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      width: DOT_SIZE,
      opacity: 1,
      ...Platform.select({
        web: {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    dotActive: {
      width: DOT_ACTIVE_SIZE,
      height: DOT_ACTIVE_SIZE,
      backgroundColor: colors.textOnDark,
      borderRadius: DOT_ACTIVE_SIZE / 2,
    },
    dotSmall: {
      width: 4,
      height: 4,
      borderRadius: 2,
      opacity: 0.5,
    },
    dotTiny: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      opacity: 0.3,
    },
    counter: {
      position: 'absolute',
      top: 14,
      left: 14,
      zIndex: DESIGN_TOKENS.zIndex.fixed,
    },
    counterMobile: {
      top: 12,
      left: 12,
    },
    counterContainer: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        },
      }),
    },
    counterText: {
      color: colors.textOnDark,
      fontSize: 13,
      fontWeight: '700' as any,
      fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });
