import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56

export const getTravelDetailsShellStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    mainContainer: {
      flex: 1,
      flexDirection: 'row',
      maxWidth: 1600,
      width: '100%',
      marginHorizontal: 'auto' as any,
    },
    mainContainerMobile: {
      flexDirection: 'column',
      alignItems: 'stretch',
      maxWidth: '100%',
      marginHorizontal: 0 as any,
    },
    sideMenuBase: {
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.borderLight,
    },
    sideMenuNative: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
    },
    sideMenuWebDesktop: {
      position: 'sticky' as any,
      top: HEADER_OFFSET_DESKTOP as any,
      backgroundColor: colors.surfaceMuted,
      backdropFilter: 'blur(20px)' as any,
      maxHeight: `calc(100vh - ${HEADER_OFFSET_DESKTOP}px)` as any,
      overflowY: 'auto' as any,
      overflowX: 'hidden' as any,
      overscrollBehavior: 'contain' as any,
      display: 'flex' as any,
      flexDirection: 'column' as any,
      minHeight: 0 as any,
    },
    sideMenuWebMobile: {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderRightWidth: 0,
      maxHeight: '100vh' as any,
      overflowY: 'auto' as any,
      paddingTop: HEADER_OFFSET_MOBILE + DESIGN_TOKENS.spacing.xl,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: Platform.select({
        // Web: reserve space for the bottom dock + sticky action bar so the
        // last rows of content stay visible above the fixed chrome on mobile.
        web: `calc(var(--mt-dock-h, 0px) + 72px)` as any,
        default: DESIGN_TOKENS.spacing.xxl,
      }),
    },
    contentOuter: {
      flex: 1,
    },
    contentWrapper: {
      flex: 1,
    },
    sectionTabsContainer: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.xl + DESIGN_TOKENS.spacing.xs,
    },
    errorTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '600',
      color: colors.text,
      marginTop: DESIGN_TOKENS.spacing.lg,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      textAlign: 'center',
    },
    errorText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xl,
      lineHeight: 24,
    },
    errorButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: DESIGN_TOKENS.spacing.xl,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: 8,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    errorButtonText: {
      color: colors.textOnPrimary,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
    },
  })

export const useTravelDetailsShellStyles = () => {
  const colors = useThemedColors()
  return useMemo(() => getTravelDetailsShellStyles(colors), [colors])
}
