import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  getNavigationActionVisual,
  type NavigationActionKind,
} from './navigationActionMeta';

export type OpenInMapsAction = {
  key: NavigationActionKind;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  actions: OpenInMapsAction[];
  onClose: () => void;
};

/**
 * Нативный bottom-sheet «Открыть в картах».
 *
 * Заменяет `Alert.alert` с 6 кнопками: на Android системный Alert надёжно
 * показывает только 3 кнопки, остальные обрезаются — отсюда «кривая вёрстка»
 * и пропавшая «Отмена» (#547). Здесь — управляемая вёрстка со скроллом,
 * крупными таргетами и явной кнопкой закрытия с учётом safe-area top,
 * плюс закрытие по фону и hardware back (`onRequestClose`).
 */
export default function OpenInMapsSheet({ visible, title = 'Открыть в картах', actions, onClose }: Props) {
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, DESIGN_TOKENS.spacing.md) }]}>
          <View style={styles.grabber} />

          <View style={[styles.header, { paddingTop: Math.min(insets.top, 12) + 4 }]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              hitSlop={10}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {actions.map((action) => {
              const visual = getNavigationActionVisual(action.key, colors);
              return (
                <Pressable
                  key={action.key}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: visual.tintBg }]}>
                    <Feather name={visual.icon} size={18} color={visual.iconColor} />
                  </View>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                  <Feather name="external-link" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Отмена"
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>Отмена</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      maxHeight: '80%',
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      marginTop: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      minHeight: 52,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    cancelButton: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    cancelLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
