import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal } from 'react-native';
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
  const [menuPosition, setMenuPosition] = useState({ top: 0 });
  const triggerRef = useRef<View>(null);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      // Сначала открываем меню с дефолтной позицией для работы в тестах
      setMenuPosition({ top: 60 });
      setIsOpen(true);

      // Затем пытаемся уточнить позицию через measure (для production)
      if (triggerRef.current && typeof triggerRef.current.measure === 'function') {
        triggerRef.current.measure((_x, _y, _width, height, _pageX, pageY) => {
          if (pageY > 0) {
            setMenuPosition({
              top: pageY + height + DESIGN_TOKENS.spacing.xs,
            });
          }
        });
      }
    } else {
      setIsOpen(false);
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
      backgroundColor: colors.backgroundSecondary,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    menu: {
      position: 'absolute',
      right: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 180,
      overflow: 'hidden',
      ...Platform.select({
        web: { boxShadow: colors.boxShadows.medium } as any,
        default: { elevation: 4 },
      }),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    menuItemPressed: {
      backgroundColor: colors.backgroundSecondary,
    },
    menuItemText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.text,
    },
    menuItemDanger: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
          <View style={[styles.menu, { top: menuPosition.top }]}>
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

