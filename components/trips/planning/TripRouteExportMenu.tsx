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
      ? 'Маршрут экспортирован как приблизительный: проверьте дорогу или тропу перед поездкой.'
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
        format === 'gpx' ? 'Сохранить маршрут GPX' : 'Сохранить маршрут KML',
      );
      if (!saved) {
        setExportError(`Не удалось создать и передать файл ${format.toUpperCase()}.`);
        return;
      }
      trackRouteExported(trip.id, format);
    } catch {
      setExportError(`Не удалось создать и передать файл ${format.toUpperCase()}.`);
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
        `Сохранить GPX для ${descriptor.label}`,
      );
      if (!saved) {
        setExportError(`Не удалось подготовить GPX для ${descriptor.label}.`);
        return;
      }
      if (descriptor.importUrl) await openExternalUrl(descriptor.importUrl);
      trackRouteExported(trip.id, descriptor.id);
    } catch {
      setExportError(`Не удалось подготовить GPX для ${descriptor.label}.`);
    } finally {
      setExportingAction(null);
    }
  };

  return (
    <View style={styles.wrap} testID="trip-route-export">
      <Text style={styles.heading}>Экспорт маршрута</Text>

      {disabled ? (
        <Text style={styles.hint}>
          Добавьте минимум две точки с координатами, чтобы экспортировать маршрут.
        </Text>
      ) : null}
      {!disabled && approximate ? (
        <Text style={styles.warning} testID="trip-route-export-approximate">
          {approximateHint ?? 'Маршрут приблизительный: GPX/KML можно скачать, но линию нужно проверить перед поездкой.'}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Button
          label={isWeb ? 'Скачать GPX' : 'Поделиться GPX'}
          onPress={() => void handleSaveExport('gpx')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'gpx'}
          testID="trip-route-export-gpx"
        />
        <Button
          label={isWeb ? 'Скачать KML' : 'Поделиться KML'}
          onPress={() => void handleSaveExport('kml')}
          variant="secondary"
          disabled={disabled || exportingAction !== null}
          loading={exportingAction === 'kml'}
          testID="trip-route-export-kml"
        />
      </View>

      {!isWeb ? (
        <Text style={styles.hint} testID="trip-route-export-native-import-hint">
          Для Garmin Connect и Komoot сначала откроется системное меню сохранения GPX,
          затем — страница импорта выбранного сервиса.
        </Text>
      ) : null}

      {exportError ? (
        <Text style={styles.error} testID="trip-route-export-error">
          {exportError}
        </Text>
      ) : null}

      <Text style={styles.label}>Открыть в навигаторе</Text>
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
