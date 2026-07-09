// components/trips/planning/TripRouteExportMenu.tsx
// Экспорт маршрута поездки (Sprint 13 / блок D): GPX/KML-скачивание (web) и
// открытие в навигаторе (Google/Apple — deeplink; Garmin/Komoot — GPX + import).
// Все внешние ссылки — только через openExternalUrl.
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { PlannedTrip, TripTransport } from '@/api/plannedTrips';
import {
  ROUTE_NAVIGATORS,
  buildGpx,
  buildKml,
  buildNavigatorUrl,
  downloadTextFileWeb,
  type NavigatorDescriptor,
  type RouteExportInput,
  type RouteWaypoint,
  type TravelMode,
} from '@/utils/routeExport';
import { openExternalUrl } from '@/utils/externalLinks';
import { trackRouteExported } from '@/utils/tripAnalytics';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

export const shouldRenderTripRouteExportMenu = (platformOS: typeof Platform.OS): boolean =>
  platformOS !== 'android';

const TRANSPORT_MODE: Record<TripTransport, TravelMode> = {
  car: 'driving',
  bike: 'cycling',
  foot: 'walking',
  public: 'driving',
  mixed: 'driving',
};

const buildExportInput = (trip: PlannedTrip): RouteExportInput => {
  const withCoords = trip.route.filter((p) => p.coordinates);
  const waypoints: RouteWaypoint[] = withCoords.map((p) => ({
    name: p.name,
    description: p.description ?? undefined,
    coordinates: p.coordinates as [number, number],
  }));
  const track = withCoords.map((p) => p.coordinates as [number, number]);
  return { name: trip.title, waypoints, track };
};

function TripRouteExportMenu({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const input = useMemo(() => buildExportInput(trip), [trip]);
  const mode = TRANSPORT_MODE[trip.transport];
  const disabled = (input.track?.length ?? 0) < 2;
  const isWeb = Platform.OS === 'web';
  const shouldRender = shouldRenderTripRouteExportMenu(Platform.OS);

  if (!shouldRender) {
    return null;
  }

  const handleDownloadGpx = () => {
    downloadTextFileWeb(buildGpx(input));
    trackRouteExported(trip.id, 'gpx');
  };

  const handleDownloadKml = () => {
    downloadTextFileWeb(buildKml(input));
    trackRouteExported(trip.id, 'kml');
  };

  const handleNavigator = (descriptor: NavigatorDescriptor) => {
    if (descriptor.kind === 'deeplink') {
      const url = buildNavigatorUrl(descriptor.id, input, { mode });
      if (!url) return;
      void openExternalUrl(url);
      trackRouteExported(trip.id, descriptor.id);
      return;
    }
    // kind === 'gpx': скачиваем трек и открываем страницу импорта провайдера.
    downloadTextFileWeb(buildGpx(input));
    if (descriptor.importUrl) void openExternalUrl(descriptor.importUrl);
    trackRouteExported(trip.id, descriptor.id);
  };

  return (
    <View style={styles.wrap} testID="trip-route-export">
      <Text style={styles.heading}>Экспорт маршрута</Text>

      {disabled ? (
        <Text style={styles.hint}>
          Добавьте минимум две точки с координатами, чтобы экспортировать маршрут.
        </Text>
      ) : null}

      {isWeb ? (
        <View style={styles.row}>
          <Button
            label="Скачать GPX"
            onPress={handleDownloadGpx}
            variant="secondary"
            disabled={disabled}
            testID="trip-route-export-gpx"
          />
          <Button
            label="Скачать KML"
            onPress={handleDownloadKml}
            variant="secondary"
            disabled={disabled}
            testID="trip-route-export-kml"
          />
        </View>
      ) : null}

      <Text style={styles.label}>Открыть в навигаторе</Text>
      <View style={styles.row}>
        {ROUTE_NAVIGATORS.map((descriptor) => (
          <Button
            key={descriptor.id}
            label={descriptor.label}
            onPress={() => handleNavigator(descriptor)}
            variant="outline"
            disabled={disabled}
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
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });

export default React.memo(TripRouteExportMenu);
