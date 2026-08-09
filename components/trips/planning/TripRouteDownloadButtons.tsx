// components/trips/planning/TripRouteDownloadButtons.tsx
// Пара кнопок «Скачать GPX» / «Скачать KML» (на native — «Поделиться»).
// Один и тот же блок стоит во вкладке «Экспорт» и в панели конструктора
// «Маршрут» (#1304): маршрут скачивается там же, где строится.
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { TripRouteExportController } from '@/components/trips/planning/tripRouteExport';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

interface Props {
  controller: TripRouteExportController;
  /** Подсказка «добавьте две точки» рядом с кнопками; в меню экспорта её печатает сам блок. */
  showDisabledHint?: boolean;
  /** Предупреждение о приблизительном маршруте; в меню экспорта — свой блок выше. */
  showApproximateWarning?: boolean;
  testID?: string;
}

function TripRouteDownloadButtons({
  controller,
  showDisabledHint = false,
  showApproximateWarning = false,
  testID,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { disabled, exportingAction, exportError, saveExport } = controller;
  const isWeb = Platform.OS === 'web';

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
          testID="trip-route-export-gpx"
        />
        <Button
          label={isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_kml_30f6a059') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_kml_5f084c27')}
          onPress={() => void saveExport('kml')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'kml'}
          testID="trip-route-export-kml"
        />
      </View>

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
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });

export default React.memo(TripRouteDownloadButtons);
