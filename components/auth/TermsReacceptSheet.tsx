import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { acceptTerms } from '@/api/consent';
import { queryKeys } from '@/api/queryKeys';
import AuthTermsGate, { useAuthTermsAcceptance } from '@/components/auth/AuthTermsGate';
import Button from '@/components/ui/Button';
import ModalSafeArea from '@/components/ui/ModalSafeArea';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

type TermsReacceptSheetProps = {
  userId: string | null;
};

/**
 * #2132: экран повторного согласия. Закрыть его можно только согласием или
 * выходом из аккаунта: системная «Назад» на Android лист не снимает. Ошибка
 * записи не глотается — человек видит её и повторяет.
 */
export default function TermsReacceptSheet({ userId }: TermsReacceptSheetProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const terms = useAuthTermsAcceptance();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleAccept = async () => {
    if (!terms.termsVersion || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await acceptTerms(terms.termsVersion);
      // Ответ `/user/me/` — источник правды: перечитываем его, а не ставим
      // `true` вслепую. Если сервер всё ещё не видит согласие, лист останется.
      await queryClient.invalidateQueries({ queryKey: queryKeys.termsAcceptedCurrent(userId) });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <ModalSafeArea style={styles.backdrop} testID="terms-reaccept-sheet">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header">
              {i18nT('authStatic:terms.reaccept.title')}
            </Text>
            <Text style={styles.body}>{i18nT('authStatic:terms.reaccept.body')}</Text>
            <AuthTermsGate
              accepted={terms.accepted}
              onChange={terms.setAccepted}
              showHint={false}
              testID="terms-reaccept-gate"
            />
            {failed ? (
              <Text style={styles.error} accessibilityLiveRegion="polite" testID="terms-reaccept-error">
                {i18nT('authStatic:terms.reaccept.error')}
              </Text>
            ) : null}
            <Button
              label={saving ? i18nT('authStatic:terms.reaccept.saving') : i18nT('authStatic:terms.reaccept.accept')}
              onPress={handleAccept}
              disabled={!terms.accepted || saving}
              loading={saving}
              variant="primary"
              size="lg"
              testID="terms-reaccept-accept"
            />
            <Button
              label={i18nT('authStatic:terms.reaccept.logout')}
              onPress={() => void logout()}
              disabled={saving}
              variant="ghost"
              testID="terms-reaccept-logout"
            />
          </View>
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 16,
    },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 480,
      gap: 12,
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
    },
    body: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
  });
