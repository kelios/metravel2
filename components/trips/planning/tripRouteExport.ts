// components/trips/planning/tripRouteExport.ts
// Общая логика экспорта маршрута поездки: сборка GPX/KML-входа и хук
// скачивания/шеринга файла. Живёт отдельно от UI, потому что кнопки
// «Скачать GPX/KML» показываются в двух местах — во вкладке «Экспорт»
// (TripRouteExportMenu) и в панели конструктора «Маршрут» (RouteBuilder, #1304).
// Файлы строятся ровно одним путём, дублировать сборку нельзя.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import {
  isRouteApproximate,
  routingStateHint,
} from '@/components/trips/planning/tripPlanFormatting';
import {
  buildGpx,
  buildKml,
  saveRouteExportFile,
  type RouteExportInput,
  type RouteWaypoint,
} from '@/utils/routeExport';
import { trackRouteExported } from '@/utils/tripAnalytics';
import { translate as i18nT } from '@/i18n';
import { hasUsableRouteGeometry } from './tripRoutePreview';

export type RouteExportFormat = 'gpx' | 'kml';

export const isTripRouteExportApproximate = (trip: PlannedTrip): boolean =>
  !hasUsableRouteGeometry(trip.routeGeometry) || isRouteApproximate(trip.routingState);

export const buildTripRouteExportInput = (trip: PlannedTrip): RouteExportInput => {
  const withCoords = trip.route.filter((p) => p.coordinates);
  const waypoints: RouteWaypoint[] = withCoords.map((p) => ({
    name: p.name,
    description: p.description ?? undefined,
    coordinates: p.coordinates as [number, number],
  }));
  const waypointTrack = withCoords.map((p) => p.coordinates as [number, number]);
  const routedTrack = hasUsableRouteGeometry(trip.routeGeometry) ? trip.routeGeometry : null;
  const approximate = isTripRouteExportApproximate(trip);
  return {
    name: trip.title,
    description: approximate
      ? i18nT('trips:components.trips.planning.TripRouteExportMenu.marshrut_eksportirovan_kak_priblizitelnyy_pr_d492205e')
      : trip.description || undefined,
    waypoints,
    track: routedTrack ?? waypointTrack,
  };
};

export interface TripRouteExportController {
  input: RouteExportInput;
  /** Меньше двух точек с координатами — экспортировать нечего. */
  disabled: boolean;
  approximate: boolean;
  approximateHint: string | null;
  exportingAction: string | null;
  setExportingAction: (action: string | null) => void;
  exportError: string | null;
  setExportError: (message: string | null) => void;
  saveExport: (format: RouteExportFormat) => Promise<void>;
}

export const useTripRouteExport = (trip: PlannedTrip): TripRouteExportController => {
  const [exportingAction, setExportingAction] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const input = useMemo(() => buildTripRouteExportInput(trip), [trip]);
  const disabled = (input.track?.length ?? 0) < 2;

  const saveExport = useCallback(
    async (format: RouteExportFormat) => {
      if (exportingAction) return;
      setExportError(null);
      setExportingAction(format);
      try {
        const file = format === 'gpx' ? buildGpx(input) : buildKml(input);
        const saved = await saveRouteExportFile(
          file,
          format === 'gpx'
            ? i18nT('trips:components.trips.planning.TripRouteExportMenu.sohranit_marshrut_gpx_da908e9f')
            : i18nT('trips:components.trips.planning.TripRouteExportMenu.sohranit_marshrut_kml_0a6163aa'),
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
    },
    [exportingAction, input, trip.id],
  );

  return {
    input,
    disabled,
    approximate: isTripRouteExportApproximate(trip),
    approximateHint: routingStateHint(trip.routingState),
    exportingAction,
    setExportingAction,
    exportError,
    setExportError,
    saveExport,
  };
};

export const shouldRenderTripRouteExportMenu = (platformOS: typeof Platform.OS): boolean =>
  platformOS === 'web' || platformOS === 'ios' || platformOS === 'android';
