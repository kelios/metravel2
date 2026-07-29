import { useCallback, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { OfflineContentType } from '@/services/offline/types';
import { showToast } from '@/utils/toast';

export default function OfflineSaveControl({
  type,
  sourceId,
  onSave,
}: {
  type: OfflineContentType;
  sourceId: string | number;
  onSave: (includePhotos: boolean) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const {
    items,
    operations,
    cancelOperation,
    retryOperation,
  } = useOfflineCatalog();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const manifest = items.find((item) => item.type === type && item.sourceId === String(sourceId));
  const operationKey = `${type}:${String(sourceId)}`;
  const operation = operations.find((item) => item.key === operationKey);

  const save = useCallback(async (includePhotos: boolean) => {
    setSaving(true);
    try {
      await onSave(includePhotos);
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') {
        showToast({ type: 'error', text1: t('offline:saveFailed') });
      }
    } finally {
      setSaving(false);
    }
  }, [onSave, t]);

  const actions = useMemo<ActionListSheetItem[]>(() => [
    {
      key: 'content',
      label: t('offline:textAndRoute'),
      icon: 'file-text',
      onPress: () => { void save(false); },
    },
    {
      key: 'photos',
      label: t('offline:withPhotos'),
      icon: 'image',
      onPress: () => { void save(true); },
    },
  ], [save, t]);

  return (
    <View style={styles.root}>
      <Button
        label={operation?.status === 'downloading'
          ? t('offline:progress', { done: operation.done, total: operation.total })
          : operation?.status === 'failed'
            ? t('offline:retry')
            : saving
          ? t('offline:saving')
          : manifest?.pinned
            ? t('offline:savedOffline')
            : t('offline:saveOffline')}
        variant={operation?.status === 'failed' ? 'danger-outline' : manifest?.pinned ? 'soft' : 'secondary'}
        size="sm"
        loading={operation?.status === 'downloading' || saving}
        onPress={() => {
          if (operation?.status === 'failed') {
            void retryOperation(operation.key).catch(() => undefined);
          } else if (!operation) {
            setVisible(true);
          }
        }}
        icon={<Feather
          name={operation?.status === 'failed' ? 'refresh-cw' : manifest?.pinned ? 'check-circle' : 'download-cloud'}
          size={16}
          color={colors.primaryDark}
        />}
      />
      {operation?.status === 'downloading' ? (
        <Button
          label={t('offline:cancel')}
          variant="ghost"
          size="sm"
          onPress={() => cancelOperation(operation.key)}
        />
      ) : null}
      {operation?.status === 'failed' ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {operation.errorCode === 'OFFLINE_STORAGE_FULL'
            ? t('offline:storageFull')
            : t('offline:saveFailed')}
        </Text>
      ) : null}
      <ActionListSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={t('offline:saveTitle')}
        actions={actions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    marginVertical: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  errorText: { fontSize: 12 },
});
