import { useCallback, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { OfflineContentType } from '@/services/offline/types';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/utils/confirmAction';
import { showToast } from '@/utils/toast';

const IS_WEB = Platform.OS === 'web';
const ICON_SIZE = 16;

/** Состояние контрола — единый источник для иконки, подписи, тона и поведения нажатия. */
type OfflineControlState = 'idle' | 'busy' | 'saved' | 'failed';

type OfflineSaveControlProps = {
  type: OfflineContentType;
  sourceId: string | number;
  onSave: (includePhotos: boolean) => Promise<unknown>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Контрол «Сохранить офлайн» — компактный статус-чип, а не отдельная кнопка-карточка:
 * тональная пилюля (без белого surface + тени), которая читается как мета-элемент страницы
 * и не конкурирует с контентом. Одна пилюля держит все четыре состояния (idle → busy →
 * saved / failed): прогресс закраской, отмену — соседней иконкой, ошибку — строкой снизу.
 * Ряд переносится (flexWrap), высота на мобильном/native ≥44 (48 на Android), на web-десктопе
 * чип компактнее — отсюда адаптивность без отдельных верстк.
 */
export default function OfflineSaveControl({
  type,
  sourceId,
  onSave,
  style,
}: OfflineSaveControlProps) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const { isMobile } = useResponsive();
  const {
    items,
    operations,
    cancelOperation,
    retryOperation,
    remove,
  } = useOfflineCatalog();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const manifest = items.find((item) => item.type === type && item.sourceId === String(sourceId));
  const operationKey = `${type}:${String(sourceId)}`;
  const operation = operations.find((item) => item.key === operationKey);

  const isDownloading = operation?.status === 'downloading';
  const isFailed = operation?.status === 'failed';
  const state: OfflineControlState = isFailed
    ? 'failed'
    : isDownloading || saving
      ? 'busy'
      : manifest?.pinned
        ? 'saved'
        : 'idle';

  // Прогресс закрашивает саму пилюлю — отдельный прогресс-бар в верстке не нужен.
  const progressRatio = isDownloading && operation && operation.total > 0
    ? Math.min(1, Math.max(0, operation.done / operation.total))
    : null;

  // Тач-таргет: native всегда ≥44 (48 на Android, M3), web-десктоп — компактный чип.
  const controlHeight = !IS_WEB || isMobile
    ? (Platform.OS === 'android' ? 48 : 44)
    : 36;

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

  // Удаление копии прямо со страницы: без него сохранённое состояние было тупиком —
  // отменить можно было только из «Офлайн-материалов».
  const removeSaved = useCallback(async () => {
    if (!manifest) return;
    const confirmed = await confirmAction({
      title: t('offline:removeTitle'),
      message: t('offline:removeDescription'),
      confirmText: t('offline:remove'),
      cancelText: t('offline:cancel'),
    });
    if (!confirmed) return;
    await remove(manifest.key).catch(() => undefined);
  }, [manifest, remove, t]);

  const actions = useMemo<ActionListSheetItem[]>(() => {
    const saveActions: ActionListSheetItem[] = [
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
    ];

    if (state !== 'saved') return saveActions;

    return [
      ...saveActions,
      {
        key: 'remove',
        label: t('offline:remove'),
        icon: 'trash-2',
        iconColor: colors.danger,
        onPress: () => { void removeSaved(); },
      },
    ];
  }, [colors.danger, removeSaved, save, state, t]);

  const tone = useMemo(() => getTones(colors)[state], [colors, state]);
  const label = isDownloading && operation
    ? `${t('offline:saving')} · ${t('offline:progress', { done: operation.done, total: operation.total })}`
    : state === 'busy'
      ? t('offline:saving')
      : state === 'failed'
        ? t('offline:retry')
        : state === 'saved'
          ? t('offline:savedOffline')
          : t('offline:saveOffline');
  const iconName = state === 'failed'
    ? 'refresh-cw'
    : state === 'saved'
      ? 'check-circle'
      : 'download-cloud';

  const handlePress = useCallback(() => {
    if (operation?.status === 'failed') {
      void retryOperation(operation.key).catch(() => undefined);
      return;
    }
    if (operation || saving) return;
    setVisible(true);
  }, [operation, retryOperation, saving]);

  return (
    <View style={[styles.root, style]} testID="offline-save-control">
      <View style={styles.row}>
        <CardActionPressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={state === 'failed' ? undefined : t('offline:saveHint')}
          accessibilityState={{ disabled: state === 'busy', busy: state === 'busy' }}
          title={state === 'failed' ? undefined : t('offline:saveHint')}
          disabled={state === 'busy'}
          onPress={handlePress}
          onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
          onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
          enableWebClickFallback
          testID="offline-save-chip"
          style={({ pressed }) => [
            styles.chip,
            globalFocusStyles.focusable,
            {
              minHeight: controlHeight,
              backgroundColor: hovered && state !== 'busy' ? tone.hoverBackground : tone.background,
              borderColor: hovered && state !== 'busy' ? tone.hoverBorder : tone.border,
            },
            pressed && styles.chipPressed,
          ]}
        >
          {progressRatio !== null ? (
            <View
              // Закраска прогресса — только фон, поверх неё те же иконка и подпись.
              pointerEvents="none"
              style={[
                styles.progressFill,
                { backgroundColor: colors.primaryAlpha30, width: `${Math.round(progressRatio * 100)}%` },
              ]}
              testID="offline-save-progress"
            />
          ) : null}
          <View style={styles.chipContent}>
            {state === 'busy' ? (
              <ActivityIndicator size="small" color={tone.accent} />
            ) : (
              <Feather name={iconName} size={ICON_SIZE} color={tone.accent} />
            )}
            <Text
              style={[
                styles.label,
                { color: tone.label, fontSize: isMobile ? DESIGN_TOKENS.typography.sizes.sm : 13 },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        </CardActionPressable>

        {isDownloading && operation ? (
          <CardActionPressable
            accessibilityRole="button"
            accessibilityLabel={t('offline:cancel')}
            title={t('offline:cancel')}
            onPress={() => cancelOperation(operation.key)}
            enableWebClickFallback
            testID="offline-save-cancel"
            style={({ pressed }) => [
              styles.cancel,
              globalFocusStyles.focusable,
              {
                width: controlHeight,
                height: controlHeight,
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.borderLight,
              },
              pressed && styles.chipPressed,
            ]}
          >
            <Feather name="x" size={ICON_SIZE} color={colors.textMuted} />
          </CardActionPressable>
        ) : null}
      </View>

      {state === 'failed' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.errorText, { color: colors.danger }]}
          testID="offline-save-error"
        >
          {operation?.errorCode === 'OFFLINE_STORAGE_FULL'
            ? t('offline:storageFull')
            : t('offline:saveFailed')}
        </Text>
      ) : null}

      <ActionListSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={state === 'saved' ? t('offline:manageTitle') : t('offline:saveTitle')}
        actions={actions}
      />
    </View>
  );
}

/**
 * Тон по состоянию: мягкий фон + акцентная рамка (тот же приём, что у QuestCompletionBadge),
 * иконка и подпись одного цвета — раньше иконка была primaryDark, а подпись colors.text.
 */
const getTones = (colors: ThemedColors): Record<OfflineControlState, {
  background: string;
  border: string;
  hoverBackground: string;
  hoverBorder: string;
  accent: string;
  label: string;
}> => {
  const brand = {
    background: colors.primaryLight,
    border: colors.primaryAlpha30,
    hoverBackground: colors.primaryAlpha30,
    hoverBorder: colors.primary,
    accent: colors.primaryText,
    label: colors.primaryText,
  };

  return {
    idle: brand,
    busy: brand,
    saved: {
      background: colors.successSoft,
      border: colors.success,
      hoverBackground: colors.successLight,
      hoverBorder: colors.successDark,
      accent: colors.success,
      label: colors.successDark,
    },
    failed: {
      background: colors.dangerSoft,
      border: colors.danger,
      hoverBackground: colors.dangerLight,
      hoverBorder: colors.dangerDark,
      accent: colors.danger,
      label: colors.danger,
    },
  };
};

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: DESIGN_TOKENS.spacing.xxs,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    maxWidth: '100%',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      } as any,
    }),
  },
  chipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    maxWidth: '100%',
  },
  progressFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  label: {
    flexShrink: 1,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    minWidth: 0,
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 16,
    maxWidth: 320,
  },
});
