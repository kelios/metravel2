import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import { Dialog, Portal } from '@/ui/paper';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import { webAccessibilityProps } from '@/utils/webProps';

export interface WizardExitDialogProps {
  visible: boolean;
  /** Можно ли сохранить прямо сейчас (есть сеть и валидный черновик). */
  canSave: boolean;
  /** Идёт сохранение (кнопка «Сохранить и выйти» в состоянии загрузки). */
  isSaving?: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
}

/**
 * Кроссплатформенный диалог выхода из мастера с несохранёнными изменениями.
 * Заменяет прежний `Alert.alert` в useTravelWizard, который не работал на web
 * (кнопка выхода была мертва). Три исхода: остаться / сохранить и выйти /
 * выйти без сохранения. На web рендерится через react-dom portal, на native —
 * через Paper Portal + Dialog, как в components/ui/ConfirmDialog.
 */
function WizardExitDialog({
  visible,
  canSave,
  isSaving = false,
  onStay,
  onDiscard,
  onSaveAndLeave,
}: WizardExitDialogProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const title = i18nT('shared:hooks.useTravelWizard.est_nesohranennye_izmeneniya_4cb67f79');
  const message = canSave
    ? i18nT('shared:hooks.useTravelWizard.sohranit_chernovik_pered_vyhodom_d0ff2d3c')
    : i18nT('shared:hooks.useTravelWizard.seychas_sohranit_nelzya_net_interneta_ili_id_55c139ab');
  const stayLabel = i18nT('shared:hooks.useTravelWizard.ostatsya_e14e72fc');
  const saveLabel = i18nT('shared:hooks.useTravelWizard.sohranit_i_vyyti_d514b94e');
  const discardLabel = i18nT('shared:hooks.useTravelWizard.vyyti_bez_sohraneniya_cd5cbc49');

  // Закрытие по Escape на web (эквивалент «Остаться»).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, onStay]);

  // На мобильном кнопки идут колонкой во всю ширину (порядок: основное действие
  // сверху), на десктопе — в ряд справа. Кнопки рендерятся напрямую в контейнере
  // действий без лишней вложенной View, иначе Paper Dialog.Actions ломает раскладку.
  const stayButton = (
    <Button
      key="stay"
      variant="ghost"
      label={stayLabel}
      onPress={onStay}
      fullWidth={isMobile}
      disabled={isSaving}
      testID="travel-wizard.exit.stay"
      accessibilityLabel={stayLabel}
    />
  );
  const discardButton = (
    <Button
      key="discard"
      variant="danger"
      label={discardLabel}
      onPress={onDiscard}
      fullWidth={isMobile}
      disabled={isSaving}
      testID="travel-wizard.exit.discard"
      accessibilityLabel={discardLabel}
    />
  );
  const saveButton = canSave ? (
    <Button
      key="save"
      variant="primary"
      label={saveLabel}
      onPress={onSaveAndLeave}
      fullWidth={isMobile}
      loading={isSaving}
      disabled={isSaving}
      testID="travel-wizard.exit.save"
      accessibilityLabel={saveLabel}
    />
  ) : null;

  // Порядок: на мобильном — основное действие («Сохранить и выйти») сверху, затем
  // «Выйти без сохранения», затем «Остаться». На десктопе — «Остаться» слева,
  // деструктив и primary справа (стандартный порядок диалога).
  const buttons = isMobile
    ? [saveButton, discardButton, stayButton]
    : [stayButton, discardButton, saveButton];

  if (Platform.OS === 'web') {
    const portal = (() => {
      try {
        const ReactDOM = require('react-dom');
        return ReactDOM?.createPortal as
          | ((node: React.ReactNode, container: Element) => React.ReactPortal)
          | undefined;
      } catch {
        return undefined;
      }
    })();
    const body = typeof document !== 'undefined' ? document.body : null;

    const content = visible ? (
      <View style={styles.webPortalRoot}>
        <View style={styles.webBackdrop}>
          <View
            style={[
              styles.dialog,
              {
                width: isMobile ? '95%' : '90%',
                maxWidth: isMobile ? '95%' : 420,
                paddingVertical: isMobile ? 16 : 20,
                paddingHorizontal: isMobile ? 20 : 24,
              },
            ]}
            {...Platform.select({
              web: webAccessibilityProps({
                'data-testid': 'travel-wizard-exit-dialog',
                role: 'dialog',
                'aria-modal': true,
              }),
            })}
          >
            <Text style={styles.dialogTitle}>{title}</Text>
            <Text style={styles.dialogText}>{message}</Text>
            <View style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
              {buttons}
            </View>
          </View>
        </View>
      </View>
    ) : null;

    const isJest = !!process.env.JEST_WORKER_ID;
    if (portal && body && !isJest) {
      return portal(content, body);
    }
    return <View style={styles.webPortalRoot}>{content}</View>;
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onStay}
        style={[
          styles.dialog,
          {
            width: isMobile ? '95%' : '90%',
            maxWidth: isMobile ? '95%' : 420,
            paddingVertical: isMobile ? 16 : 20,
            paddingHorizontal: isMobile ? 20 : 24,
          },
        ]}
      >
        <Dialog.Title style={styles.dialogTitle}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogText}>{message}</Text>
          <View style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
            {buttons}
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

export default React.memo(WizardExitDialog);

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    webPortalRoot: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
    },
    webBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.overlay,
      padding: DESIGN_TOKENS.spacing.md,
    },
    dialog: {
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      ...DESIGN_TOKENS.shadowsNative.medium,
      ...Platform.select({
        web: { boxShadow: DESIGN_TOKENS.shadows.modal },
      }),
    },
    dialogTitle: {
      fontWeight: '600',
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    dialogText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textMuted,
      marginBottom: DESIGN_TOKENS.spacing.lg,
      lineHeight: 22,
    },
    actionContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      flexWrap: 'wrap',
    },
    actionContainerMobile: {
      flexDirection: 'column',
      // nowrap обязателен: базовый actionContainer имеет flexWrap:'wrap' (для
      // десктопного ряда из 3 кнопок); в колонке с ограниченной высотой это
      // перекидывало «Остаться» во второй столбец за край экрана.
      flexWrap: 'nowrap',
      alignItems: 'stretch',
      width: '100%',
      gap: DESIGN_TOKENS.spacing.sm,
    },
  });
