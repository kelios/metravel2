import { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal, Dimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

interface ProfileMenuProps {
  onLogout: () => void;
  onSettings?: () => void;
}

export function ProfileMenu({ onLogout, onSettings }: ProfileMenuProps) {
  const colors = useThemedColors();
  const [isOpen, setIsOpen] = useState(false);
  // Default position keeps the menu usable in tests (where measure returns 0)
  // and before measureInWindow resolves.
  const [menuPosition, setMenuPosition] = useState({ top: 60, right: DESIGN_TOKENS.spacing.md });
  const triggerRef = useRef<View>(null);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    // Open immediately with the last/default position so the menu is interactive
    // even if measurement is unavailable (RNTL) or slow.
    setIsOpen(true);

    const node = triggerRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      // measureInWindow gives absolute window coordinates directly — more reliable
      // than parent-relative measure() across web/native.
      node.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) return; // no layout yet (e.g. tests) → keep fallback

        const { width: winWidth, height: winHeight } = Dimensions.get('window');
        // Anchor below the trigger, clamped so the menu never overflows the viewport bottom.
        const top = Math.max(
          DESIGN_TOKENS.spacing.xs,
          Math.min(y + height + DESIGN_TOKENS.spacing.xs, winHeight - 160)
        );
        // Align the menu's right edge to the trigger's right edge.
        const right = Math.max(DESIGN_TOKENS.spacing.md, winWidth - (x + width));
        setMenuPosition({ top, right });
      });
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    onLogout();
  }, [onLogout]);

  const handleSettings = useCallback(() => {
    setIsOpen(false);
    onSettings?.();
  }, [onSettings]);

  const styles = useMemo(() => StyleSheet.create({
    trigger: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    triggerPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    menu: {
      position: 'absolute',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minWidth: 220,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow:
            (colors.boxShadows as any)?.modal ??
            (colors.boxShadows as any)?.medium ??
            DESIGN_TOKENS.shadows.modal,
        } as any,
        default: { elevation: 4 },
      }),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      marginHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    menuItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    menuItemText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.text,
    },
    menuItemDanger: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      borderRadius: 0,
      marginTop: DESIGN_TOKENS.spacing.xs,
      paddingTop: DESIGN_TOKENS.spacing.md,
    },
    menuItemTextDanger: {
      color: colors.danger,
    },
  }), [colors]);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.trigger,
            pressed && styles.triggerPressed,
            globalFocusStyles.focusable,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Меню профиля"
          accessibilityHint="Открыть меню с дополнительными действиями"
        >
          <Feather name="more-vertical" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={[styles.menu, { top: menuPosition.top, right: menuPosition.right }]}>
            {onSettings && (
              <Pressable
                onPress={handleSettings}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                  globalFocusStyles.focusable,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Настройки"
                accessibilityHint="Перейти к настройкам профиля"
              >
                <Feather name="settings" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Настройки</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuItem,
                onSettings ? styles.menuItemDanger : undefined,
                pressed && styles.menuItemPressed,
                globalFocusStyles.focusable,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Выйти из аккаунта"
              accessibilityHint="Выйти из текущего аккаунта"
            >
              <Feather name="log-out" size={16} color={colors.danger} />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                Выйти
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

