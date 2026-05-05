import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';

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
        <View
          style={styles.dialog}
          accessibilityRole="alert"
          accessibilityLabel="Найден локальный черновик"
        >
          <View style={styles.iconContainer}>
            <Feather name="edit-3" size={30} color={colors.primary} />
          </View>

          <Text style={styles.title}>Есть несохранённые изменения</Text>
          <Text style={styles.message}>
            Мы нашли локальный черновик этой статьи от {formattedTime}. Вы можете продолжить с ним
            или открыть сохранённую версию.
          </Text>

          <View style={styles.note}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={styles.noteText}>
              Если статью уже сохранили, выбирайте сохранённую версию.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              label="Открыть сохранённую"
              variant="outline"
              size="md"
              fullWidth
              icon={<Feather name="file" size={16} color={colors.text} />}
              onPress={onDiscard}
              accessibilityLabel="Открыть сохранённую версию"
              disabled={isRecovering}
            />

            <Button
              label={isRecovering ? 'Восстановление...' : 'Продолжить с черновика'}
              variant="primary"
              size="md"
              fullWidth
              icon={<Feather name="refresh-cw" size={16} color={colors.textOnPrimary} />}
              onPress={onRecover}
              accessibilityLabel="Продолжить с локального черновика"
              loading={isRecovering}
            />
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
      maxWidth: 460,
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
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    note: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primarySoft,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    noteText: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'column',
      gap: DESIGN_TOKENS.spacing.sm,
      width: '100%',
    },
  });

export default React.memo(DraftRecoveryDialog);
