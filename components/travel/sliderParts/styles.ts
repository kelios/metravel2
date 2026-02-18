import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const DOT_SIZE = 6;
const DOT_ACTIVE_WIDTH = 20;

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
      backgroundColor: 'transparent',
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
      // Fill the slide while the image is loading to avoid showing page background through
      // (which can appear as a gray flash on scroll / virtualization).
      backgroundColor: colors.background,
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
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      width: 36,
      height: 36,
      borderRadius: 18,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      marginTop: -20,
    },
    navBtnMobile: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginTop: -17,
    },
    navBtnTablet: {
      width: 38,
      height: 38,
      borderRadius: 19,
      marginTop: -19,
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
      bottom: 14,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: DESIGN_TOKENS.zIndex.fixed,
    },
    dotsMobile: {
      bottom: 12,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 0,
      gap: 4,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(16px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.8)',
        },
      }),
    },
    dotWrap: {
      paddingHorizontal: 1,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    dot: {
      backgroundColor: 'rgba(255,255,255,0.35)',
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
      width: DOT_ACTIVE_WIDTH,
      backgroundColor: '#ffffff',
      borderRadius: DOT_SIZE / 2,
      ...Platform.select({
        web: {
          boxShadow: '0 0 8px rgba(255,255,255,0.4)',
        } as any,
      }),
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
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 0,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        },
      }),
    },
    counterText: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 12,
      fontWeight: '600' as any,
      fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
      letterSpacing: 0.3,
    },
  });
