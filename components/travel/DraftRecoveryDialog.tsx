import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface DraftRecoveryDialogProps {
  visible: boolean;
  draftTimestamp: number | null;
  onRecover: () => void;
  onDiscard: () => void;
  isRecovering?: boolean;
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'неизвестное время';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DraftRecoveryDialog({
  visible,
  draftTimestamp,
  onRecover,
  onDiscard,
  isRecovering = false,
}: DraftRecoveryDialogProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formattedTime = formatTimestamp(draftTimestamp);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDiscard}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconContainer}>
            <Feather name="file-text" size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>Найден черновик</Text>
          <Text style={styles.message}>
            У вас есть несохранённый черновик ({formattedTime}).
            Хотите продолжить редактирование?
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onDiscard}
              style={({ pressed }) => [
                styles.button,
                styles.discardButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Начать заново"
              disabled={isRecovering}
            >
              <Feather name="trash-2" size={16} color={colors.textMuted} />
              <Text style={styles.discardButtonText}>Начать заново</Text>
            </Pressable>

            <Pressable
              onPress={onRecover}
              style={({ pressed }) => [
                styles.button,
                styles.recoverButton,
                pressed && styles.buttonPressed,
                isRecovering && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Восстановить черновик"
              disabled={isRecovering}
            >
              <Feather name="refresh-cw" size={16} color={colors.textOnPrimary} />
              <Text style={styles.recoverButtonText}>
                {isRecovering ? 'Загрузка...' : 'Восстановить'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: DESIGN_TOKENS.spacing.lg,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.xl,
      maxWidth: 400,
      width: '100%',
      alignItems: 'center',
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    message: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    actions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      width: '100%',
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    discardButton: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recoverButton: {
      backgroundColor: colors.primary,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    discardButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.textMuted,
    },
    recoverButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  });

export default React.memo(DraftRecoveryDialog);
