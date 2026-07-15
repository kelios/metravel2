// components/trips/planning/TripRouteExportMenu.tsx
// Экспорт маршрута поездки (Sprint 13 / блок D): GPX/KML-скачивание (web) и
// открытие в навигаторе (Google/Apple — deeplink; Garmin/Komoot — GPX + import).
// Все внешние ссылки — только через openExternalUrl.
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { PlannedTrip, TripTransport } from '@/api/plannedTrips';
import {
  isRouteApproximate,
  routingStateHint,
} from '@/components/trips/planning/tripPlanFormatting';
import {
  ROUTE_NAVIGATORS,
  buildGpx,
  buildKml,
  buildNavigatorUrl,
  saveRouteExportFile,
  type NavigatorDescriptor,
  type RouteExportInput,
  type RouteWaypoint,
  type TravelMode,
} from '@/utils/routeExport';
import { openExternalUrl } from '@/utils/externalLinks';
import { trackRouteExported } from '@/utils/tripAnalytics';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface Props {
  trip: PlannedTrip;
}

export const shouldRenderTripRouteExportMenu = (platformOS: typeof Platform.OS): boolean =>
  platformOS === 'web' || platformOS === 'ios' || platformOS === 'android';

const TRANSPORT_MODE: Record<TripTransport, TravelMode> = {
  car: 'driving',
  bike: 'cycling',
  foot: 'walking',
  public: 'driving',
  mixed: 'driving',
};

export const buildTripRouteExportInput = (trip: PlannedTrip): RouteExportInput => {
  const withCoords = trip.route.filter((p) => p.coordinates);
  const waypoints: RouteWaypoint[] = withCoords.map((p) => ({
    name: p.name,
    description: p.description ?? undefined,
    coordinates: p.coordinates as [number, number],
  }));
  const waypointTrack = withCoords.map((p) => p.coordinates as [number, number]);
  const routedTrack = trip.routeGeometry && trip.routeGeometry.length >= 2
    ? trip.routeGeometry
    : null;
  const approximate = isRouteApproximate(trip.routingState);
  return {
    name: trip.title,
    description: approximate
      ? i18nT('trips:components.trips.planning.TripRouteExportMenu.marshrut_eksportirovan_kak_priblizitelnyy_pr_d492205e')
      : trip.description || undefined,
    waypoints,
    track: routedTrack ?? waypointTrack,
  };
};

function TripRouteExportMenu({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exportingAction, setExportingAction] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const input = useMemo(() => buildTripRouteExportInput(trip), [trip]);
  const mode = TRANSPORT_MODE[trip.transport];
  const disabled = (input.track?.length ?? 0) < 2;
  const approximate = isRouteApproximate(trip.routingState);
  const approximateHint = routingStateHint(trip.routingState);
  const isWeb = Platform.OS === 'web';
  const shouldRender = shouldRenderTripRouteExportMenu(Platform.OS);

  if (!shouldRender) {
    return null;
  }

  const handleSaveExport = async (format: 'gpx' | 'kml') => {
    if (exportingAction) return;
    setExportError(null);
    setExportingAction(format);
    try {
      const file = format === 'gpx' ? buildGpx(input) : buildKml(input);
      const saved = await saveRouteExportFile(
        file,
        format === 'gpx' ? i18nT('trips:components.trips.planning.TripRouteExportMenu.sohranit_marshrut_gpx_da908e9f') : i18nT('trips:components.trips.planning.TripRouteExportMenu.sohranit_marshrut_kml_0a6163aa'),
      );
      if (!saved) {
        setExportError(i18nT('trips:components.trips.planning.TripRouteExportMenu.ne_udalos_sozdat_i_peredat_fayl_value1_7bf4c699', { value1: format.toUpperCase() }));
        return;
      }
      trackRouteExported(trip.id, format);
    } catch {
      setExportError(i18nT('trips:components.trips.planning.TripRouteExportMenu.ne_udalos_sozdat_i_peredat_fayl_value1_7bf4c699', { value1: format.toUpperCase() }));
    } finally {
      setExportingAction(null);
    }
  };

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

      <View style={styles.row}>
        <Button
          label={isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_gpx_cc6c1a54') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_gpx_f240186b')}
          onPress={() => void handleSaveExport('gpx')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'gpx'}
          testID="trip-route-export-gpx"
        />
        <Button
          label={isWeb ? i18nT('trips:components.trips.planning.TripRouteExportMenu.skachat_kml_30f6a059') : i18nT('trips:components.trips.planning.TripRouteExportMenu.podelitsya_kml_5f084c27')}
          onPress={() => void handleSaveExport('kml')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'kml'}
          testID="trip-route-export-kml"
        />
      </View>

      {!isWeb ? (
        <Text style={styles.hint} testID="trip-route-export-native-import-hint">
          {i18nT('trips:components.trips.planning.TripRouteExportMenu.dlya_garmin_connect_i_komoot_snachala_otkroe_2647f7ca')}</Text>
      ) : null}

      {exportError ? (
        <Text style={styles.error} testID="trip-route-export-error">
          {exportError}
        </Text>
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
    error: { fontSize: 12, color: colors.danger, lineHeight: 16, fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });

export default React.memo(TripRouteExportMenu);
