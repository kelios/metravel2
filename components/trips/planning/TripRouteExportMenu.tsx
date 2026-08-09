// components/trips/planning/TripRouteExportMenu.tsx
// Экспорт маршрута поездки (Sprint 13 / блок D): GPX/KML-скачивание (web) и
// открытие в навигаторе (Google/Apple — deeplink; Garmin/Komoot — GPX + import).
// Сборка файлов и состояние экспорта живут в tripRouteExport, потому что те же
// кнопки скачивания стоят в панели конструктора «Маршрут» (#1304).
// Все внешние ссылки — только через openExternalUrl.
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { PlannedTrip, TripTransport } from '@/api/plannedTrips';
import TripRouteDownloadButtons from '@/components/trips/planning/TripRouteDownloadButtons';
import {
  shouldRenderTripRouteExportMenu,
  useTripRouteExport,
} from '@/components/trips/planning/tripRouteExport';
import {
  ROUTE_NAVIGATORS,
  buildGpx,
  buildNavigatorUrl,
  saveRouteExportFile,
  type NavigatorDescriptor,
  type TravelMode,
} from '@/utils/routeExport';
import { openExternalUrl } from '@/utils/externalLinks';
import { trackRouteExported } from '@/utils/tripAnalytics';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface Props {
  trip: PlannedTrip;
}

export {
  buildTripRouteExportInput,
  shouldRenderTripRouteExportMenu,
} from '@/components/trips/planning/tripRouteExport';

const TRANSPORT_MODE: Record<TripTransport, TravelMode> = {
  car: 'driving',
  bike: 'cycling',
  foot: 'walking',
  public: 'driving',
  mixed: 'driving',
};

function TripRouteExportMenu({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const exportController = useTripRouteExport(trip);
  const {
    input,
    disabled,
    approximate,
    approximateHint,
    exportingAction,
    setExportingAction,
    setExportError,
  } = exportController;

  const mode = TRANSPORT_MODE[trip.transport];
  const isWeb = Platform.OS === 'web';
  const shouldRender = shouldRenderTripRouteExportMenu(Platform.OS);

  if (!shouldRender) {
    return null;
  }

  const handleNavigator = async (descriptor: NavigatorDescriptor) => {
    if (exportingAction) return;
    setExportError(null);
    if (descriptor.kind === 'deeplink') {
      const url = buildNavigatorUrl(descriptor.id, input, { mode });
      if (!url) return;
      void openExternalUrl(url);
      trackRouteExported(trip.id, descriptor.id);
      return;
    }
    // Garmin/Komoot consume a GPX file. Produce and hand off the real file first;
    // only then open the provider import page so native never promises a fake import.
    setExportingAction(descriptor.id);
    try {
      const saved = await saveRouteExportFile(
        buildGpx(input),
        i18nT('trips:components.trips.planning.TripRouteExportMenu.sohranit_gpx_dlya_value1_4b3e9e5c', { value1: descriptor.label }),
      );
      if (!saved) {
        setExportError(i18nT('trips:components.trips.planning.TripRouteExportMenu.ne_udalos_podgotovit_gpx_dlya_value1_97c06ef1', { value1: descriptor.label }));
        return;
      }
      if (descriptor.importUrl) await openExternalUrl(descriptor.importUrl);
      trackRouteExported(trip.id, descriptor.id);
    } catch {
      setExportError(i18nT('trips:components.trips.planning.TripRouteExportMenu.ne_udalos_podgotovit_gpx_dlya_value1_97c06ef1', { value1: descriptor.label }));
    } finally {
      setExportingAction(null);
    }
  };

  return (
    <View style={styles.wrap} testID="trip-route-export">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripRouteExportMenu.eksport_marshruta_3bdeb871')}</Text>

      {disabled ? (
        <Text style={styles.hint}>
          {i18nT('trips:components.trips.planning.TripRouteExportMenu.dobavte_minimum_dve_tochki_s_koordinatami_ch_4a19e760')}</Text>
      ) : null}
      {!disabled && approximate ? (
        <Text style={styles.warning} testID="trip-route-export-approximate">
          {approximateHint ?? i18nT('tripsStatic:route.approximateExportWarning')}
        </Text>
      ) : null}

      <TripRouteDownloadButtons controller={exportController} />

      {!isWeb ? (
        <Text style={styles.hint} testID="trip-route-export-native-import-hint">
          {i18nT('trips:components.trips.planning.TripRouteExportMenu.dlya_garmin_connect_i_komoot_snachala_otkroe_2647f7ca')}</Text>
      ) : null}

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripRouteExportMenu.otkryt_v_navigatore_8d026e76')}</Text>
      <View style={styles.row}>
        {ROUTE_NAVIGATORS.map((descriptor) => (
          <Button
            key={descriptor.id}
            label={descriptor.label}
            onPress={() => void handleNavigator(descriptor)}
            variant="outline"
            disabled={disabled || exportingAction !== null}
            loading={exportingAction === descriptor.id}
            testID={`trip-route-export-${descriptor.id}`}
          />
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    warning: { fontSize: 12, color: colors.warningDark, lineHeight: 16, fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });

export default React.memo(TripRouteExportMenu);
