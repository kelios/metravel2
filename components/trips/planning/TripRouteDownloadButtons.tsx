// components/trips/planning/TripRouteDownloadButtons.tsx
// Ряд действий «Скачать GPX» / «Скачать KML» (на native — «Поделиться»)
// и, при наличии, скачивание исходного файла.
// Один и тот же блок стоит во вкладке «Экспорт» и в панели конструктора
// «Маршрут» (#1304): маршрут скачивается там же, где строится.
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow';
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

  // #1414 (TestFlight 1.0.5 (8)): на телефоне все три действия рисовались одной
  // и той же иконкой `download` без подписи — «иконки непонятные что они
  // значат». Формат файла и есть смысл действия, поэтому в compact-режиме он
  // остаётся текстом (`compactLabel`), а полное название действия
  // («Поделиться GPX») уходит в accessibilityLabel. Ряд при этом по-прежнему
  // одна строка: три коротких слова помещаются на 320–402dp.
  const actions: ToolAction[] = [
    {
      key: 'gpx',
      label: isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_gpx_cc6c1a54') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_gpx_f240186b'),
      compactLabel: i18nT('tripsStatic:route.exportFormatGpx'),
      icon: <Feather name="download" size={16} color={colors.primaryDark} />,
      onPress: () => void saveExport('gpx'),
      variant: 'secondary',
      disabled: disabled || exportingAction !== null,
      loading: exportingAction === 'gpx',
      testID: 'trip-route-export-gpx',
    },
    {
      key: 'kml',
      label: isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_kml_30f6a059') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_kml_5f084c27'),
      compactLabel: i18nT('tripsStatic:route.exportFormatKml'),
      icon: <Feather name="download" size={16} color={colors.primaryDark} />,
      onPress: () => void saveExport('kml'),
      variant: 'secondary',
      disabled: disabled || exportingAction !== null,
      loading: exportingAction === 'kml',
      testID: 'trip-route-export-kml',
    },
    ...(canDownloadOriginal ? [{
      key: 'original',
      label: isWeb
        ? i18nT('tripsStatic:route.originalDownload')
        : i18nT('tripsStatic:route.originalShare'),
      compactLabel: i18nT('tripsStatic:route.originalCompact'),
      icon: <Feather name="download" size={16} color={colors.primaryDark} />,
      onPress: () => void handleDownloadOriginal(),
      variant: 'outline' as const,
      disabled: originalDownloading,
      loading: originalDownloading,
      testID: 'trip-route-export-original',
    }] : []),
  ];

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

      {canDownloadOriginal ? (
        <View testID="trip-route-original-download-block">
          <Text style={styles.hint}>
            {i18nT('tripsStatic:route.originalDownloadHint', {
              value: originalFile?.original_name ?? '',
            })}
          </Text>
        </View>
      ) : null}

      <ToolActionsRow actions={actions} />

      {originalError ? (
        <Text style={styles.error} testID="trip-route-export-original-error">
          {originalError}
        </Text>
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
  });

export default React.memo(TripRouteDownloadButtons);
