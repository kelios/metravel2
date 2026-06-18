import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

import { isWebPlatform } from './constants'

export const getStyles = (colors: ThemedColors) =>
  StyleSheet.create<Record<string, any>>({
    card: {
      alignSelf: 'stretch',
      marginVertical: 12,
      marginHorizontal: 8,
      borderRadius: 24,
      backgroundColor: colors.surface,
      ...colors.shadows.medium,
      overflow: 'hidden',
      position: 'relative',
      ...(isWebPlatform()
        ? ({ transition: 'transform 150ms ease, box-shadow 150ms ease' } as any)
        : null),
    },
    cardHovered: {
      ...(isWebPlatform()
        ? ({
            transform: [{ translateY: -2 }],
            boxShadow: colors.boxShadows.heavy,
          } as any)
        : null),
    },
    image: {
      flex: 1,
      justifyContent: 'flex-end',
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.backgroundTertiary,
    },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlayLight },
    noImageFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 16,
    },
    noImageFallbackText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.textMuted,
      maxWidth: '90%',
    },
    loader: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 24,
    },
    mainPressable: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    mainPressArea: { flex: 1 },

    iconCol: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 3,
      gap: 10,
      flexDirection: 'column',
    },
    iconBtn: {
      backgroundColor: colors.overlay,
      margin: 0,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      ...colors.shadows.medium,
    },
    iconBtnLight: {
      backgroundColor: colors.backgroundSecondary,
      margin: 0,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...colors.shadows.medium,
    },
    iconBtnDanger: {
      backgroundColor: colors.danger,
      margin: 0,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      ...colors.shadows.medium,
    },

    overlay: {
      padding: 20,
      backgroundColor: colors.overlay,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      zIndex: 2,
      position: 'relative',
    },
    overlayLight: {
      backgroundColor: colors.backgroundSecondary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    title: {
      color: colors.textOnDark,
      fontWeight: '800',
      marginBottom: 10,
      lineHeight: 24,
      letterSpacing: -0.4,
      ...(isWebPlatform()
        ? ({ textShadow: `0px 2px 8px ${colors.overlay}` } as any)
        : {
            textShadowColor: colors.overlay,
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 8,
          }),
    },
    titleOnLight: {
      ...(isWebPlatform()
        ? ({ textShadow: 'none' } as any)
        : {
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }),
    },
    distanceRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    distanceBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...colors.shadows.light,
    },
    distanceTextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    distanceText: {
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    coordPressable: {
      alignSelf: 'flex-start',
      marginBottom: 12,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    coord: {
      color: colors.textOnDark,
      textDecorationLine: 'underline',
      fontWeight: '700',
      letterSpacing: 0.3,
      fontFamily: isWebPlatform() ? 'Monaco, Menlo, "Ubuntu Mono", monospace' : 'monospace',
      ...(isWebPlatform()
        ? ({ textShadow: `0px 1px 4px ${colors.overlay}` } as any)
        : {
            textShadowColor: colors.overlay,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }),
    },
    coordOnLight: {
      ...(isWebPlatform()
        ? ({ textShadow: 'none' } as any)
        : {
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }),
    },
    catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    catChip: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    catText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    addButtonRow: { marginTop: DESIGN_TOKENS.spacing.md },
    addButtonRowWithFav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    addButtonFlex: { flex: 1 },
    favButton: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: { cursor: 'pointer' as any, transition: 'all 0.2s ease' },
      }),
    },
    favButtonActive: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: { cursor: 'pointer' as any, transition: 'all 0.2s ease' },
      }),
    },
    addButtonMobile: {
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingVertical: DESIGN_TOKENS.spacing.xs + 2,
    },
    addButtonSuccess: { backgroundColor: colors.success },
    addButtonPressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
    addButtonDisabled: { opacity: 0.6 },
    addButtonText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.2 },
    addButtonTextMobile: { fontSize: 11 },
  })
