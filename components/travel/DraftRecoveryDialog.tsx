import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { formatDate, translate as i18nT } from '@/i18n'


interface DraftRecoveryDialogProps {
  visible: boolean;
  draftTimestamp: number | null;
  onRecover: () => void;
  onDiscard: () => void;
  isRecovering?: boolean;
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return i18nT('travel:components.travel.DraftRecoveryDialog.neizvestnoe_vremya_38b61a26');

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return i18nT('travel:components.travel.DraftRecoveryDialog.tolko_chto_a2c21d64');
  if (diffMins < 60) return i18nT('travel:components.travel.DraftRecoveryDialog.value1_min_nazad_9eb6bbea', { value1: diffMins });
  if (diffHours < 24) return i18nT('travel:components.travel.DraftRecoveryDialog.value1_ch_nazad_54cc86ac', { value1: diffHours });

  return formatDate(date, {
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
          accessibilityLabel={i18nT('travel:components.travel.DraftRecoveryDialog.nayden_lokalnyy_chernovik_0dd4d86c')}
        >
          <View style={styles.iconContainer}>
            <Feather name="edit-3" size={30} color={colors.primaryDark} />
          </View>

          <Text style={styles.title}>{i18nT('travel:components.travel.DraftRecoveryDialog.est_nesohranennye_izmeneniya_b2189b41')}</Text>
          <Text style={styles.message}>
            {i18nT('travel:components.travel.DraftRecoveryDialog.my_nashli_lokalnyy_chernovik_etogo_puteshest_252112b5')}{formattedTime}{i18nT('travel:components.travel.DraftRecoveryDialog.vy_mozhete_prodolzhit_s_nim_ili_otkryt_sohra_83454798')}</Text>

          <View style={styles.note}>
            <Feather name="info" size={16} color={colors.primaryDark} />
            <Text style={styles.noteText}>
              {i18nT('travel:components.travel.DraftRecoveryDialog.esli_puteshestvie_uzhe_sohranili_vybirayte_s_e5584f3b')}</Text>
          </View>

          <View style={styles.actions}>
            <Button
              label={i18nT('travel:components.travel.DraftRecoveryDialog.otkryt_sohranennuyu_a08fba4f')}
              variant="outline"
              size="md"
              fullWidth
              icon={<Feather name="file" size={16} color={colors.text} />}
              onPress={onDiscard}
              accessibilityLabel={i18nT('travel:components.travel.DraftRecoveryDialog.otkryt_sohranennuyu_versiyu_ad039b1a')}
              disabled={isRecovering}
            />

            <Button
              label={isRecovering ? i18nT('travel:components.travel.DraftRecoveryDialog.vosstanovlenie_9af70ff1') : i18nT('travel:components.travel.DraftRecoveryDialog.prodolzhit_s_chernovika_238fa662')}
              variant="primary"
              size="md"
              fullWidth
              icon={<Feather name="refresh-cw" size={16} color={colors.textOnPrimary} />}
              onPress={onRecover}
              accessibilityLabel={i18nT('travel:components.travel.DraftRecoveryDialog.prodolzhit_s_lokalnogo_chernovika_4e5e67fc')}
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
