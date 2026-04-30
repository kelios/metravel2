import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';

const PANEL_RADIUS = DESIGN_TOKENS.radii.lg;
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm;

/**
 * Shared styles for header components.
 * Eliminates duplication across AccountMenu, DesktopAccountSection, MobileAccountSection.
 */

export const createAnchorStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    anchor: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      maxWidth: 220,
      minHeight: 44,
      minWidth: 44,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transition:
              'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
          } as any)
        : null),
    },
    anchorHover: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              (colors.boxShadows as any)?.hover ?? '0 8px 16px rgba(17, 24, 39, 0.12)',
          } as any)
        : null),
    },
  });

export const createAvatarStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    avatarSlot: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    anchorText: {
      fontSize: 16,
      color: colors.text,
      flexShrink: 1,
    },
    chevronSlot: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });

export const createCtaLoginStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    ctaLoginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primary,
      minHeight: 36,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transition: 'background-color 160ms ease, transform 120ms ease',
          } as any)
        : null),
    },
    ctaLoginButtonHover: {
      backgroundColor: colors.primaryDark,
      ...(Platform.OS === 'web' ? ({ transform: 'translateY(-1px)' } as any) : null),
    },
    ctaLoginText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    ctaLoginIconSlot: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });

export const createMenuStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    menuContent: {
      backgroundColor: colors.surface,
      borderRadius: PANEL_RADIUS,
      paddingVertical: 8,
      minWidth: 288,
      maxWidth: 340,
      borderColor: colors.borderLight,
      borderWidth: 1,
      ...(Platform.OS === 'web'
        ? ({
            marginTop: 6,
            boxShadow:
              (colors.boxShadows as any)?.modal ??
              '0 18px 40px rgba(17, 24, 39, 0.16), 0 6px 14px rgba(17, 24, 39, 0.10)',
          } as any)
        : DESIGN_TOKENS.shadowsNative.light),
    },
    sectionTitle: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 8,
      borderRadius: CONTROL_RADIUS,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    sectionHeaderText: {
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'capitalize',
      color: colors.textMuted,
      fontWeight: '600',
      flex: 1,
      textAlign: 'left',
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 4,
      marginHorizontal: 12,
    },
    themeSection: {
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    menuItem: {
      borderRadius: CONTROL_RADIUS,
      marginHorizontal: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    menuItemTitle: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    menuItemTitleStrong: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
    },
  });

export const createIconSlotStyles = () =>
  StyleSheet.create({
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
  });

export const createUnreadBadgeStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.textOnPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
  });
