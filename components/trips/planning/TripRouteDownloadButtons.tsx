// components/trips/planning/TripRouteDownloadButtons.tsx
// Ряд действий «Скачать GPX» / «Скачать KML» (на native — «Поделиться»)
// и, при наличии, скачивание исходных файлов — по карточке на файл (#2069).
// Один и тот же блок стоит во вкладке «Экспорт» и в панели конструктора
// «Маршрут» (#1304): маршрут скачивается там же, где строится.
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow';
import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes';
import type { TripRouteExportController } from '@/components/trips/planning/tripRouteExport';
import TripRouteStoredFiles from '@/components/trips/planning/TripRouteStoredFiles';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

interface Props {
  controller: TripRouteExportController;
  /** Подсказка «добавьте две точки» рядом с кнопками; в меню экспорта её печатает сам блок. */
  showDisabledHint?: boolean;
  /**
   * Короткая строка про экспорт приблизительной линии (макет §1). Причину
   * приблизительности показывает карта (#2057); в меню экспорта — свой блок выше.
   */
  showApproximateWarning?: boolean;
  /**
   * Исходные GPX/KML поездки (#1496), ноль или несколько (#2069). Каждый
   * скачивается ровно теми байтами, которые были загружены, — в отличие от
   * кнопок выше, которые собирают файл заново из текущих точек маршрута. Во
   * вкладке «Маршрут» оригиналы скачиваются из своих карточек в
   * `TripRouteImportPanel` (#2053), поэтому туда они не передаются.
   */
  tripId?: number | string | null;
  originalFiles?: readonly PlannedTripRouteFile[];
  /**
   * #2053, блок «Файл маршрута»: GPX и KML с полными подписями делят ширину
   * блока поровну на любой ширине экрана; не помещаются — ряд переносит кнопку.
   * Только для владельца: у участника этого блока нет, и его GPX/KML остаются
   * обычным компактным рядом инструментов (`docs/RULES.md` → UI rules).
   */
  fill?: boolean;
  testID?: string;
}

function TripRouteDownloadButtons({
  controller,
  showDisabledHint = false,
  showApproximateWarning = false,
  tripId = null,
  originalFiles,
  fill = false,
  testID,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { disabled, exportingAction, exportError, saveExport } = controller;
  const isWeb = Platform.OS === 'web';

  // #1414 (TestFlight 1.0.5 (8)): на телефоне все три действия рисовались одной
  // и той же иконкой `download` без подписи — «иконки непонятные что они
  // значат». Формат файла и есть смысл действия, поэтому в compact-режиме он
  // остаётся текстом (`compactLabel`), а полное название действия
  // («Поделиться GPX») уходит в accessibilityLabel. Подпись не сжимается: не
  // хватает ширины — ряд переносит кнопку (#2053). Вариант у обоих скачиваний
  // один: по смыслу это одно и то же действие над разными форматами.
  const actions: ToolAction[] = [
    {
      key: 'gpx',
      label: isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_gpx_cc6c1a54') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_gpx_f240186b'),
      compactLabel: i18nT('tripsStatic:route.exportFormatGpx'),
      icon: <Feather name="download" size={16} color={colors.primaryDark} />,
      onPress: () => void saveExport('gpx'),
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
      disabled: disabled || exportingAction !== null,
      loading: exportingAction === 'kml',
      testID: 'trip-route-export-kml',
    },
  ];

  return (
    <View style={styles.wrap} testID={testID}>
      {showDisabledHint && disabled ? (
        <Text style={styles.hint}>
          {i18nT('trips:components.trips.planning.TripRouteExportMenu.dobavte_minimum_dve_tochki_s_koordinatami_ch_4a19e760')}</Text>
      ) : null}
      {showApproximateWarning && !disabled && controller.approximate ? (
        <Text style={styles.warning} testID="trip-route-download-approximate">
          {i18nT('tripsStatic:route.approximateExportLine')}
        </Text>
      ) : null}

      <ToolActionsRow actions={actions} compact={fill ? false : undefined} fill={fill} />

      {/* Оригиналов может быть несколько (#2069): у каждого своя карточка с
          именем, размером и «Скачать оригинал», та же, что во вкладке
          «Маршрут», только без удаления. */}
      {originalFiles?.length ? (
        <TripRouteStoredFiles
          files={originalFiles}
          tripId={tripId}
          testIDPrefix="trip-route-export"
          testID="trip-route-original-download-block"
        />
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
