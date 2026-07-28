import { useCallback, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';
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
  const { items } = useOfflineCatalog();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const manifest = items.find((item) => item.type === type && item.sourceId === String(sourceId));

  const save = useCallback(async (includePhotos: boolean) => {
    setSaving(true);
    try {
      await onSave(includePhotos);
    } catch {
      showToast({ type: 'error', text1: t('offline:saveFailed') });
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
        label={saving
          ? t('offline:saving')
          : manifest?.pinned
            ? t('offline:savedOffline')
            : t('offline:saveOffline')}
        variant={manifest?.pinned ? 'soft' : 'secondary'}
        size="sm"
        loading={saving}
        onPress={() => setVisible(true)}
        icon={<Feather name={manifest?.pinned ? 'check-circle' : 'download-cloud'} size={16} color={colors.primaryDark} />}
      />
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
  },
});
