import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export const createModernFiltersStyles = (colors: ReturnType<typeof useThemedColors>) => {
  const { spacing, typography, radii } = DESIGN_TOKENS;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radii.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
          width: 300,
          position: 'sticky' as any,
          top: spacing.lg,
          maxHeight: 'calc(100vh - 32px)' as any,
          overflowY: 'auto' as any,
        },
        default: {},
      }),
    },
    containerMobile: {
      flex: 1,
      borderRadius: radii.xl,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.surface,
      elevation: 0,
      ...Platform.select({
        web: {
          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
        } as any,
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
      }),
    },
    containerWebFull: {
      width: '100%',
      maxWidth: '100%',
      height: '100vh' as any,
      borderRadius: 0,
      position: 'relative',
      top: 0,
      maxHeight: '100vh' as any,
      boxShadow: 'none' as any,
      display: 'flex' as any,
      flexDirection: 'column' as any,
      overflowY: 'hidden' as any,
    },
    containerCompact: {
      padding: spacing.md,
      ...Platform.select({
        web: {
          width: 240,
        },
      }),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold as any,
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    iconSlot16: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot18: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    closeButton: {
      padding: spacing.xs,
    },
    toggleAllButton: {
      marginBottom: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.pill,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    toggleAllButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    toggleAllButtonText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium as any,
    },
    clearButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.brandSoft,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    clearButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.brandText,
    },
    clearAllMobileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    clearAllMobileButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    resultsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      minHeight: 32,
      borderRadius: radii.pill,
      marginBottom: spacing.xs,
    },
    resultsBadgeText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    sortSection: {
      marginBottom: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        },
      }),
    },
    sortDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    sortDropdownTriggerHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    sortDropdownTriggerActive: {
      backgroundColor: colors.primarySoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sortDropdownTriggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    sortDropdownIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortDropdownTextContainer: {
      flex: 1,
    },
    sortDropdownLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: typography.weights.medium as any,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sortDropdownValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold as any,
      marginTop: 2,
    },
    sortDropdownChevron: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortDropdownContent: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.surface,
      gap: 2,
    },
    sortOption: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: 0,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      ...Platform.select({
        web: {
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    sortOptionCompact: {
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
    },
    sortOptionSelected: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandAlpha30,
    },
    sortOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    sortIconContainer: {
      width: 24,
      height: 24,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortIconContainerSelected: {
      backgroundColor: colors.brandAlpha30,
    },
    sortCheckIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortOptionTextSelected: {
      color: colors.brandDark,
      fontWeight: typography.weights.semibold as any,
    },
    extraFilters: {
      marginBottom: spacing.xs,
      gap: spacing.xs,
    },
    yearGroup: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 0,
      marginTop: spacing.md,
      marginBottom: 0,
      paddingTop: spacing.sm,
      paddingBottom: 0,
    },
    yearInlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    yearGroupContent: {
      marginTop: spacing.sm,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    yearLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    yearLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.semibold as any,
    },
    yearInput: {
      flexBasis: 96,
      maxWidth: 96,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      alignSelf: 'flex-start',
      minHeight: 32,
      ...Platform.select({
        web: {
          outlineWidth: 0,
        },
      }),
    },
    moderationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    moderationRowSelected: {
      backgroundColor: colors.primarySoft,
    },
    moderationLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    moderationLabelSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
    scrollView: {
      flex: 1,
      ...Platform.select({
        web: {
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        } as any,
      }),
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.lg,
    },
    filterGroup: {
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.sm,
    },
    filterGroupLast: {
      borderBottomWidth: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      minHeight: 36,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      minWidth: 0,
    },
    groupHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
      marginLeft: spacing.xs,
    },
    groupTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text,
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    selectedBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radii.pill,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        } as any,
      }),
    },
    selectedBadgeText: {
      fontSize: 11,
      fontWeight: typography.weights.bold as any,
      color: colors.textOnPrimary,
      lineHeight: 14,
    },
    selectedSummaryRow: {
      marginBottom: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.primarySoft,
      borderWidth: 1.5,
      borderColor: colors.primaryAlpha30,
      gap: 4,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
        } as any,
      }),
    },
    selectedSummaryLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.primaryText,
    },
    selectedSummaryText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      lineHeight: 16,
      fontWeight: typography.weights.medium as any,
    },
    groupContent: {
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.lg,
      marginBottom: spacing.xs,
      minHeight: 48,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    filterOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
        transform: 'translateX(2px)',
      } as any,
    }),
    filterOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    filterOptionText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.regular as any,
    },
    sortOptionText: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionTextSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionCount: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioLarge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioChecked: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    radioDotLarge: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    applyButtonContainer: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          gap: spacing.xs,
          position: 'sticky' as any,
          bottom: 0,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
        } as any,
      }),
    },
    resetMobileButton: {
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: spacing.xs,
    },
    resetMobileButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textMuted,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      alignItems: 'center',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
          backgroundSize: '200% 100%',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35), 0 2px 8px rgba(139, 92, 246, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        } as any,
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        },
      }),
    },
    applyButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold as any,
      color: colors.textOnPrimary,
      letterSpacing: 0.3,
    },
  });
};
