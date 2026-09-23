// components/trips/planning/TripRouteStoredFiles.tsx
// Сохранённые исходные GPX/KML поездки списком (#2069): файлов у поездки ноль
// или несколько, и у каждого своя карточка — имя, размер, «Скачать оригинал» и,
// во вкладке «Маршрут», «Удалить оригинал» с подтверждением (#2054). Один
// компонент для двух мест: блок «Файл маршрута» вкладки «Маршрут» и скачивание
// оригиналов во вкладке «Экспорт» — байты везде те же, что были загружены.
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatFileSize } from '@/utils/fileSize';
import { useTripRouteOriginalDownload } from './useTripRouteOriginalDownload';

type Props = {
  files: readonly PlannedTripRouteFile[];
  tripId: number | string | null;
  /**
   * Префикс testID карточек: `trip-route-import` во вкладке «Маршрут»,
   * `trip-route-export` во вкладке «Экспорт».
   */
  testIDPrefix: string;
  disabled?: boolean;
  /** Файл, чей DELETE сейчас в полёте: его «Удалить» занята, остальные выключены. */
  removingFileId?: number | null;
  /**
   * Удаление одного файла по id. Без него карточки только скачивают. Список
   * вызывает его лишь из подтверждения: «Удалить» в карточке открывает окно.
   */
  onRemoveFile?: (routeId: number) => void;
  testID?: string;
};

type Styles = ReturnType<typeof createStyles>;

type CardProps = {
  file: PlannedTripRouteFile;
  tripId: number | string | null;
  testIDPrefix: string;
  removeAction: ToolAction | null;
  styles: Styles;
  colors: ThemedColors;
};

// Своя карточка — свой `useTripRouteOriginalDownload`: «скачивается» и ошибка
// скачивания относятся к одному файлу, а не ко всему списку.
function StoredFileCard({ file, tripId, testIDPrefix, removeAction, styles, colors }: CardProps) {
  const { t } = useTranslation();
  const download = useTripRouteOriginalDownload(tripId, file);

  // #2053: подписи полные на любой ширине — ряд переносит кнопку, а не режет подпись.
  const actions: ToolAction[] = [
    ...(download.available ? [{
      key: 'download-original',
      label: download.label,
      icon: <Feather name="download" size={16} color={colors.primaryDark} />,
      onPress: () => void download.download(),
      disabled: download.downloading,
      loading: download.downloading,
      testID: `${testIDPrefix}-download-original`,
    }] : []),
    ...(removeAction ? [removeAction] : []),
  ];

  return (
    <View style={styles.card} testID={`${testIDPrefix}-stored-original`}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {file.original_name}
        </Text>
        <Text style={styles.hint}>
          {t('tripsStatic:plan.routeImport.original.stored', {
            value: file.size ? formatFileSize(Number(file.size)) : '—',
          })}
        </Text>
      </View>
      <ToolActionsRow actions={actions} compact={false} />
      {download.error ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          testID={`${testIDPrefix}-original-download-error`}
        >
          {download.error}
        </Text>
      ) : null}
    </View>
  );
}

function TripRouteStoredFiles({
  files,
  tripId,
  testIDPrefix,
  disabled = false,
  removingFileId = null,
  onRemoveFile,
  testID,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // #2054: удаление оригинала необратимо — скачать файл потом неоткуда. Окно
  // помнит id файла, а не флаг: если этот файл исчез из списка, пока окно
  // открыто, подтверждать уже нечего, и соседний файл, которого пользователь не
  // выбирал, не удаляется.
  const [removeConfirmFileId, setRemoveConfirmFileId] = useState<number | null>(null);
  const removeConfirmVisible =
    removeConfirmFileId != null && files.some((file) => file.id === removeConfirmFileId);
  const closeRemoveConfirm = useCallback(() => setRemoveConfirmFileId(null), []);
  // Повтор подтверждения в одном тике глушит синхронный лок удаления (#1824)
  // в `useTripRouteFileBranch`: окно закрывается только со следующим рендером.
  const handleConfirmRemove = useCallback(() => {
    if (removeConfirmFileId == null) return;
    setRemoveConfirmFileId(null);
    onRemoveFile?.(removeConfirmFileId);
  }, [onRemoveFile, removeConfirmFileId]);

  if (!files.length) return null;

  return (
    <View style={styles.list} testID={testID}>
      {files.map((file) => (
        <StoredFileCard
          key={file.id}
          file={file}
          tripId={tripId}
          testIDPrefix={testIDPrefix}
          styles={styles}
          colors={colors}
          removeAction={onRemoveFile ? {
            key: 'remove-original',
            label: t('tripsStatic:plan.routeImport.original.remove'),
            icon: <Feather name="trash-2" size={16} color={colors.danger} />,
            onPress: () => setRemoveConfirmFileId(file.id),
            variant: 'danger-outline',
            // Один DELETE за раз (лок #1824 в файловой ветке): пока удаляется
            // один файл, «Удалить» соседних выключены, а занята — только его.
            disabled: disabled || removingFileId != null,
            loading: removingFileId === file.id,
            testID: `${testIDPrefix}-remove-original`,
          } : null}
        />
      ))}
      {/* «Удалить» (danger) — подпись окна по умолчанию, «Отмена» — та же,
          что у отмены предпросмотра импорта. */}
      {onRemoveFile ? (
        <ConfirmDialog
          visible={removeConfirmVisible}
          onClose={closeRemoveConfirm}
          onConfirm={handleConfirmRemove}
          title={t('tripsStatic:plan.routeImport.original.removeConfirmTitle')}
          message={t('tripsStatic:plan.routeImport.original.removeConfirmMessage')}
          cancelText={t('tripsStatic:plan.routeImport.cancel')}
          confirmTestID={`${testIDPrefix}-remove-original-confirm`}
          cancelTestID={`${testIDPrefix}-remove-original-cancel`}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  list: { gap: DESIGN_TOKENS.spacing.sm },
  // Колонка, а не строка: имя файла получает всю ширину карточки (до двух
  // строк), а «Скачать»/«Удалить» — свой ряд под ним (#2053).
  card: {
    gap: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  body: { minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});

export default React.memo(TripRouteStoredFiles);
