import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/api/client';
import { useRareAwardCatalog, useGrantRareAward } from '@/hooks/useAchievementsApi';

interface Props {
  /** Получатель награды — владелец просматриваемого профиля. */
  recipientId: string | number;
  recipientName?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Недостаточно прав для выдачи награды.';
    if (error.status === 404) return 'Пользователь или награда не найдены.';
    if (error.status === 409) return 'Эта награда уже выдана или достигнут лимит владельцев.';
    if (error.status === 400) return 'Проверьте выбор награды и причину.';
  }
  return 'Не удалось выдать награду. Попробуйте позже.';
};

function AdminGrantRareAward({ recipientId, recipientName, testID, style }: Props) {
  const colors = useThemedColors();
  const isSuperuser = useAuthStore((s) => s.isSuperuser);
  const [open, setOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);

  const { data: catalog, isLoading } = useRareAwardCatalog(open);
  const grant = useGrantRareAward();

  const styles = getStyles(colors);

  // Гейт: только админ/модератор видит контрол.
  if (!isSuperuser) return null;

  const reset = () => {
    setSelectedSlug(null);
    setReason('');
    setDone(false);
    grant.reset();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const canSubmit =
    selectedSlug != null && reason.trim().length > 0 && !grant.isPending;

  const submit = () => {
    if (!canSubmit || !selectedSlug) return;
    grant.mutate(
      { userId: recipientId, awardSlug: selectedSlug, reason: reason.trim() },
      { onSuccess: () => setDone(true) },
    );
  };

  return (
    <>
      <Pressable
        style={[styles.button, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Выдать редкую награду"
        testID={testID}
      >
        <Feather name="star" size={16} color={colors.primary} />
        <Text style={styles.buttonLabel}>Выдать редкую награду</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Закрыть">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>
                Редкая награда{recipientName ? ` · ${recipientName}` : ''}
              </Text>
              <Pressable
                style={styles.closeBtn}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            {done ? (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={40} color={colors.success} />
                <Text style={styles.successText}>Награда выдана</Text>
                <Pressable style={styles.primaryBtn} onPress={close}>
                  <Text style={styles.primaryBtnText}>Готово</Text>
                </Pressable>
              </View>
            ) : isLoading || !catalog ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Категория</Text>
                {catalog.map((item) => {
                  const selected = item.slug === selectedSlug;
                  return (
                    <Pressable
                      key={item.slug}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                      onPress={() => setSelectedSlug(item.slug)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.title}
                    >
                      <View style={styles.optionText}>
                        <Text style={styles.optionName} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.description ? (
                          <Text style={styles.optionDesc} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={20}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  );
                })}

                <Text style={styles.label}>Причина</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="За что вручается награда"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  accessibilityLabel="Причина выдачи награды"
                />

                {grant.isError ? (
                  <Text style={styles.errorText}>{errorMessage(grant.error)}</Text>
                ) : null}

                <Pressable
                  style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
                  onPress={submit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit }}
                  accessibilityLabel="Выдать награду"
                >
                  {grant.isPending ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Выдать награду</Text>
                  )}
                </Pressable>
                <View style={styles.footerSpace} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
    },
    buttonLabel: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      maxHeight: '85%',
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '800',
      color: colors.text,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.xl, alignItems: 'center' },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.text,
      marginTop: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    optionRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    optionText: { flex: 1, minWidth: 0 },
    optionName: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '700', color: colors.text },
    optionDesc: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
    reasonInput: {
      minHeight: 72,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: DESIGN_TOKENS.spacing.sm,
      color: colors.text,
      textAlignVertical: 'top',
    },
    errorText: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.danger,
    },
    primaryBtn: {
      marginTop: DESIGN_TOKENS.spacing.md,
      paddingVertical: 14,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },
    successBox: { alignItems: 'center', gap: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.xl },
    successText: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '800', color: colors.text },
    footerSpace: { height: DESIGN_TOKENS.spacing.xxl },
  });

export default memo(AdminGrantRareAward);
