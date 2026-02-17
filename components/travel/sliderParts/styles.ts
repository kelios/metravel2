import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const DOT_SIZE = 6;

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
          touchAction: 'pan-x pan-y',
          overflowX: 'auto',
          overflowY: 'hidden',
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
      marginTop: -28,
      backgroundColor: colors.overlay || colors.overlayLight,
      borderWidth: 1,
      borderColor: colors.borderStrong || colors.borderLight,
      width: 56,
      height: 56,
      borderRadius: 28,
      zIndex: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select<any>({
        web: {
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          contain: 'layout',
        },
      }),
    },
    navBtnDesktop: {
      width: 56,
      height: 56,
    },
    navBtnMobile: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginTop: -20,
      backgroundColor: colors.overlayLight,
    },
    navBtnTablet: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginTop: -24,
    },
    navBtnHover: {
      backgroundColor: colors.surface,
    },
    arrowIconContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowIcon: {},
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
      bottom: 16,
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
      backgroundColor: colors.overlayLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 6,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      }),
    },
    dotWrap: {
      paddingHorizontal: 4,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    dot: {
      backgroundColor: colors.textMuted,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      width: DOT_SIZE,
      opacity: 0.5,
      ...Platform.select({
        web: {
          transition: 'width 0.25s ease, opacity 0.25s ease',
        },
      }),
    },
    dotActive: {
      width: 18,
      opacity: 1,
      backgroundColor: colors.text,
    },
    counter: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: DESIGN_TOKENS.zIndex.fixed,
    },
    counterMobile: {
      top: 12,
      left: 12,
    },
    counterContainer: {
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      }),
    },
    counterText: {
      color: '#fff',
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700' as any,
      fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system' : undefined,
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });

