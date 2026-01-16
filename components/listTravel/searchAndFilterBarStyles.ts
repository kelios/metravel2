import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export const createSearchAndFilterBarStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'column',
      marginBottom: 0,
      gap: Platform.select({ default: 8, web: 10 }),
      paddingHorizontal: Platform.select({ default: 12, web: 16 }),
      paddingVertical: Platform.select({ default: 10, web: 12 }),
      width: '100%',
      maxWidth: '100%',
      borderRadius: Platform.select({ default: 16, web: 20 }),
      backgroundColor: colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
        },
        android: {
          elevation: 1,
        },
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          position: 'relative' as any,
          zIndex: 3000,
        },
      }),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
      width: '100%',
      maxWidth: '100%',
      overflow: 'visible',
      flexWrap: 'nowrap',
    },
    topRowMobile: {
      gap: spacing.xs,
    },
    searchContainer: {
      flex: 1,
      position: 'relative',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'visible',
      ...Platform.select({
        web: {
          zIndex: 2000,
        },
      }),
    },
    wrapMobile: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      marginBottom: 0,
      marginTop: 0,
      gap: spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.md,
      width: '34%',
      maxWidth: 360,
      alignSelf: 'center',
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Platform.select({ default: 8, web: 10 }),
      backgroundColor: colors.surfaceMuted,
      borderRadius: Platform.select({ default: 999, web: 999 }),
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: Platform.select({ default: 18, web: 20 }),
      height: Platform.select({
        default: 54,
        web: 56,
      }),
      minWidth: 0,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: {
          elevation: 1,
        },
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    searchBoxActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        ios: {
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
        web: {
          boxShadow: `0 0 0 4px ${colors.primarySoft}, ${DESIGN_TOKENS.shadows.medium}`,
        },
      }),
    },
    searchBoxMobile: {
      height: 44,
      paddingHorizontal: 12,
      gap: 6,
    },
    input: {
      flex: 1,
      fontSize: Platform.select({ default: 16, web: 18 }),
      color: colors.text,
      fontWeight: '500',
      paddingVertical: 2,
      lineHeight: Platform.select({ default: 22, web: 26 }),
      minWidth: 0,
      ...Platform.select({
        web: {
          outlineWidth: 0,
          backgroundColor: 'transparent',
        },
      }),
    },
    inputMobile: {
      fontSize: 14,
      paddingVertical: 1,
      lineHeight: 20,
    },
    searchIconBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      paddingRight: 4,
    },
    searchIconBadgeMobile: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    searchDivider: {
      width: 0,
      marginHorizontal: 0,
      opacity: 0,
      flexShrink: 0,
    },
    searchDividerMobile: {
      marginHorizontal: spacing.xxs,
    },
    clearBtn: {
      padding: 6,
      borderRadius: 50,
      minWidth: 32,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 0,
      flexShrink: 0,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          // @ts-ignore
          ':hover': {
            backgroundColor: colors.backgroundSecondary,
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    actionIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Platform.select({ default: spacing.xxs, web: spacing.xs }),
      marginLeft: Platform.select({ default: spacing.xxs, web: spacing.xs }),
      flexShrink: 0,
      ...Platform.select({
        web: {
          minWidth: 'fit-content' as any,
        },
      }),
    },
    actionIconsMobile: {
      gap: spacing.xxs,
      marginLeft: spacing.xxs,
    },
    resultsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'nowrap',
      gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
      marginTop: spacing.xs,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    resultsRowMobile: {
      marginTop: spacing.xs,
      flexWrap: 'wrap',
    },
    resultsContent: {
      flex: 1,
      minWidth: 0,
      maxWidth: '100%',
      ...Platform.select({
        web: {
          overflow: 'hidden' as any,
        },
      }),
    },
    resultsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      flexShrink: 1,
      minWidth: 0,
    },
    resultsBadgeMobile: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
    },
    resultsText: {
      fontSize: Platform.select({
        default: 12,
        web: 13,
      }),
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
      lineHeight: Platform.select({
        default: 16,
        web: 18,
      }),
      flexShrink: 1,
    },
    clearAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.md }),
      paddingVertical: Platform.select({ default: spacing.xs, web: spacing.xs }),
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      minHeight: Platform.select({ default: 36, web: 38 }),
      minWidth: 36,
      flexShrink: 0,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap' as any,
          // @ts-ignore
          ':hover': {
            backgroundColor: colors.primarySoft,
          },
        },
      }),
    },
    clearAllBtnText: {
      fontSize: Platform.select({ default: 11, web: 12 }),
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.text,
      flexShrink: 1,
    },
    recommendationsToggle: {
      width: Platform.select({ default: 48, web: 52 }),
      height: Platform.select({ default: 48, web: 52 }),
      borderRadius: Platform.select({ default: 14, web: 16 }),
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 48,
      minHeight: 48,
      flexShrink: 0,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 2,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          // @ts-ignore
          ':hover': {
            backgroundColor: colors.primarySoft,
            borderColor: colors.primary,
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    recommendationsToggleMobile: {
      width: 40,
      height: 40,
      minWidth: 40,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
    },
    recommendationsToggleActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: `0 0 0 3px ${colors.primarySoft}`,
        },
      }),
    },
  });
