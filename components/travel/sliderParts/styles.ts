import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const DOT_SIZE = 8;

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
      ...Platform.select<any>({
        web: { willChange: 'transform', contain: 'paint' },
        default: {},
      }),
    },
    clipMobile: {
      borderRadius: DESIGN_TOKENS.radii.md,
    },
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : {}),
    },
    scrollSnap: Platform.OS === 'web'
      ? ({
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
          touchAction: 'pan-x',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          scrollBehavior: 'smooth',
        } as any)
      : {},
    scrollContent: {
      flexDirection: 'row',
    },
    slide: {
      flexShrink: 0,
      position: 'relative',
      backgroundColor: colors.surfaceMuted || '#2a2a2a',
      overflow: 'hidden',
      ...Platform.select<any>({
        web: { contain: 'content', willChange: 'transform' },
        default: {},
      }),
    },
    slidePlaceholder: {
      backgroundColor: colors.backgroundTertiary || '#333',
    },
    slideSnap: Platform.OS === 'web'
      ? ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as any)
      : {},
    blurBg: {
      ...StyleSheet.absoluteFillObject,
    },
    flatBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#1a1a1a',
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
    navBtn: {
      position: 'absolute',
      top: '50%',
      marginTop: -18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      zIndex: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select<any>({
        web: {
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, transform 0.15s ease',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          contain: 'layout',
          ':hover': {
            backgroundColor: 'rgba(0,0,0,0.55)',
          },
        },
      }),
    },
    navBtnDesktop: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginTop: -20,
    },
    navBtnMobile: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginTop: -16,
    },
    navBtnTablet: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginTop: -18,
    },
    navBtnHover: {
      backgroundColor: 'rgba(0,0,0,0.55)',
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
    edgeScrimLeft: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 140,
      zIndex: 20,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          } as any)
        : null),
    },
    edgeScrimRight: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: 140,
      zIndex: 20,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to left, rgba(0,0,0,0.45), rgba(0,0,0,0))',
          } as any)
        : null),
    },
    dots: {
      position: 'absolute',
      bottom: 12,
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
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 0,
      gap: 6,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        },
      }),
    },
    dotWrap: {
      paddingHorizontal: 3,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    dot: {
      backgroundColor: 'rgba(255,255,255,0.45)',
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      width: DOT_SIZE,
      opacity: 1,
      ...Platform.select({
        web: {
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    dotActive: {
      width: DOT_SIZE,
      backgroundColor: '#ffffff',
      transform: [{ scale: 1.3 }],
      ...Platform.select({
        web: {
          boxShadow: '0 0 6px rgba(255,255,255,0.6)',
        } as any,
      }),
    },
    counter: {
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: DESIGN_TOKENS.zIndex.fixed,
    },
    counterMobile: {
      top: 10,
      left: 10,
    },
    counterContainer: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 0,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        },
      }),
    },
    counterText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600' as any,
      fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
      letterSpacing: 0.3,
    },
  });

