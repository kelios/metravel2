import { Platform, StatusBar, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';

/**
 * Creates styles for CustomHeader component.
 * Extracted to reduce component file size and improve maintainability.
 */
export const createCustomHeaderStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
      paddingTop: Platform.OS === 'ios' ? (StatusBar.currentHeight || 0) : 0,
      paddingBottom: Platform.OS === 'web' ? (isMobile ? 6 : 12) : 0,
      borderBottomWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: colors.border,
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 2000,
            width: '100%',
          } as any)
        : { zIndex: 10 }),
    },
    wrapper: {
      width: '100%',
      backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
      ...Platform.select({
        ios: {
          ...DESIGN_TOKENS.shadowsNative.light,
        },
        android: {
          elevation: 3,
          shadowColor: DESIGN_TOKENS.shadowsNative.light.shadowColor,
        },
        web: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          boxShadow: DESIGN_TOKENS.shadows.card as any,
        },
      }),
    },
    inner: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      ...Platform.select({
        ios: {
          minHeight: 44,
          paddingTop: (StatusBar.currentHeight || 0) + 8,
        },
        android: {
          minHeight: 48,
          paddingTop: (StatusBar.currentHeight || 0) + 6,
        },
        web: {
          minHeight: 56,
          paddingHorizontal: isMobile ? 8 : 24,
          paddingVertical: isMobile ? 6 : 10,
        },
      }),
      ...(Platform.OS === 'web' && {
        marginLeft: 'auto',
        marginRight: 'auto',
      }),
    },
    innerMobile: {
      paddingHorizontal: 6,
    },
    navContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    navScroll: {
      flex: 1,
      marginHorizontal: 12,
      minHeight: 44,
    },
    iconSlot18: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot20: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot24: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    mobileUserPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      maxWidth: 180,
      gap: 6,
      minHeight: 44,
    },
    mobileUserPillPlaceholder: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      maxWidth: 180,
      gap: 6,
      minHeight: 44,
      opacity: 0,
    },
    mobileUserAvatarContainer: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    mobileUserAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    mobileUserName: {
      fontSize: 16,
      color: colors.text,
      flexShrink: 1,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      gap: 6,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
      flexShrink: 0,
      ...Platform.select({
        web: {
          transition: 'background-color 0.15s ease-out' as any,
          cursor: 'pointer' as any,
        },
      }),
    },
    navItemHover: {
      backgroundColor: colors.primarySoft,
    },
    navItemActive: {
      backgroundColor: colors.brandLight,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light as any,
        },
      }),
    },
    navLabel: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      letterSpacing: -0.1,
    },
    navLabelActive: {
      color: colors.brandText,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      letterSpacing: -0.2,
    },
    mobileMenuButton: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.brand,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      gap: 8,
      minHeight: 44,
      minWidth: 44,
      ...Platform.select({
        web: {
          transition:
            'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease' as any,
          cursor: 'pointer' as any,
          boxShadow: `0 4px 14px ${colors.brand}40` as any,
        },
      }),
    },
    createButtonHover: {
      opacity: 0.96,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)' as any,
          boxShadow: DESIGN_TOKENS.shadows.heavy as any,
          filter: 'brightness(0.98)' as any,
        },
      }),
    },
    createLabel: {
      color: colors.textOnPrimary,
      fontSize: 14,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      letterSpacing: -0.1,
    },
    createIconComposite: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    createIconPlus: {
      position: 'absolute',
      top: -4,
      right: -4,
    },
    createIconPin: {
      position: 'absolute',
      bottom: -4,
      right: -4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalCloseButton: {
      padding: 4,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalNavContainer: {
      paddingVertical: 8,
    },
    modalSectionTitle: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      textTransform: 'capitalize',
      letterSpacing: 0.6,
    },
    modalNavItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
      minHeight: 48,
    },
    modalNavItemHover: {
      backgroundColor: colors.primarySoft,
    },
    modalNavItemActive: {
      backgroundColor: colors.primaryLight,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 17,
    },
    modalNavLabel: {
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: '500',
      flex: 1,
    },
    modalNavLabelActive: {
      color: colors.primaryText,
      fontWeight: '600',
    },
    modalDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
  });

export const webStickyStyle =
  Platform.OS === 'web'
    ? { position: 'sticky' as const, top: 0, zIndex: 2000, width: '100%' }
    : null;
