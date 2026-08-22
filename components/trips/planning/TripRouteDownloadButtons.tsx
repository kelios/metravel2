// components/trips/planning/TripRouteDownloadButtons.tsx
// Пара кнопок «Скачать GPX» / «Скачать KML» (на native — «Поделиться»).
// Один и тот же блок стоит во вкладке «Экспорт» и в панели конструктора
// «Маршрут» (#1304): маршрут скачивается там же, где строится.
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes';
import type { TripRouteExportController } from '@/components/trips/planning/tripRouteExport';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { downloadPlannedTripRouteFile } from '@/utils/travelRouteDownload';
import { translate as i18nT } from '@/i18n';

interface Props {
  controller: TripRouteExportController;
  /** Подсказка «добавьте две точки» рядом с кнопками; в меню экспорта её печатает сам блок. */
  showDisabledHint?: boolean;
  /** Предупреждение о приблизительном маршруте; в меню экспорта — свой блок выше. */
  showApproximateWarning?: boolean;
  /**
   * Исходный GPX/KML поездки (#1496). Скачивается ровно теми байтами, которые
   * были загружены, — в отличие от кнопок выше, которые собирают файл заново из
   * текущих точек маршрута.
   */
  tripId?: number | string | null;
  originalFile?: PlannedTripRouteFile | null;
  testID?: string;
}

function TripRouteDownloadButtons({
  controller,
  showDisabledHint = false,
  showApproximateWarning = false,
  tripId = null,
  originalFile = null,
  testID,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [originalDownloading, setOriginalDownloading] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);

  const { disabled, exportingAction, exportError, saveExport } = controller;
  const isWeb = Platform.OS === 'web';
  const canDownloadOriginal = tripId != null && originalFile != null;

  const handleDownloadOriginal = useCallback(async () => {
    if (tripId == null || !originalFile) return;
    setOriginalError(null);
    setOriginalDownloading(true);
    try {
      const saved = await downloadPlannedTripRouteFile(tripId, originalFile);
      if (!saved) setOriginalError(i18nT('tripsStatic:route.originalDownloadError'));
    } catch {
      setOriginalError(i18nT('tripsStatic:route.originalDownloadError'));
    } finally {
      setOriginalDownloading(false);
    }
  }, [originalFile, tripId]);

  return (
    <View style={styles.wrap} testID={testID}>
      {showDisabledHint && disabled ? (
        <Text style={styles.hint}>
          {i18nT('trips:components.trips.planning.TripRouteExportMenu.dobavte_minimum_dve_tochki_s_koordinatami_ch_4a19e760')}</Text>
      ) : null}
      {showApproximateWarning && !disabled && controller.approximate ? (
        <Text style={styles.warning}>
          {controller.approximateHint ?? i18nT('tripsStatic:route.approximateExportWarning')}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Button
          label={isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_gpx_cc6c1a54') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_gpx_f240186b')}
          onPress={() => void saveExport('gpx')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'gpx'}
          style={styles.button}
          testID="trip-route-export-gpx"
        />
        <Button
          label={isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_kml_30f6a059') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_kml_5f084c27')}
          onPress={() => void saveExport('kml')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'kml'}
          style={styles.button}
          testID="trip-route-export-kml"
        />
      </View>

      {canDownloadOriginal ? (
        <View style={styles.originalBlock} testID="trip-route-original-download-block">
          <Text style={styles.hint}>
            {i18nT('tripsStatic:route.originalDownloadHint', {
              value: originalFile?.original_name ?? '',
            })}
          </Text>
          <Button
            label={isWeb
              ? i18nT('tripsStatic:route.originalDownload')
              : i18nT('tripsStatic:route.originalShare')}
            onPress={() => void handleDownloadOriginal()}
            variant="outline"
            disabled={originalDownloading}
            loading={originalDownloading}
            style={styles.button}
            testID="trip-route-export-original"
          />
          {originalError ? (
            <Text style={styles.error} testID="trip-route-export-original-error">
              {originalError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {exportError ? (
        <Text style={styles.error} testID="trip-route-export-error">
          {exportError}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    warning: { fontSize: 12, color: colors.warningDark, lineHeight: 16, fontWeight: '600' },
    error: { fontSize: 12, color: colors.danger, lineHeight: 16, fontWeight: '600' },
    // Паритет mobile web ↔ Android держится правилом «по содержимому, потом расти»:
    // одинаковый перенос на обеих поверхностях. Жёсткие половины (`flexBasis: 0`)
    // пробовали — на 393 dp native-подпись «Поделиться GPX» обрезалась до
    // «Поделиться G…», поэтому кнопки сначала занимают свою ширину и переносятся
    // целиком, а лишнее место делят между собой.
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    originalBlock: { gap: 8 },
    // `minWidth` обязателен: подпись кнопки — `Text` с `numberOfLines={1}`, он
    // соглашается сжаться, поэтому без жёсткого минимума две кнопки всегда
    // влезают в строку и на телефоне обрезаются до «Поделиться G…».
    button: { flexGrow: 1, flexBasis: 'auto', minWidth: 200 },
  });

export default React.memo(TripRouteDownloadButtons);
