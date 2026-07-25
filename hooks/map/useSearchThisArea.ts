import { useCallback, useMemo, useState } from 'react';

import type { MapClusterBBox } from '@/api/map';
import type { MapMovePayload } from '@/components/MapPage/Map/types';

// F-49 — "Search this area" (Google/Organic-Maps style). Извлечено из
// useMapScreenController. Порог появления кнопки считается от радиуса поиска И
// от размера видимой области (см. canSearchThisArea), базовая точка отсчёта
// заводится с первого же отчёта карты.

type LatLng = { latitude: number; longitude: number };

// F-49 — approximate great-circle distance in km between two lat/lng points.
// Used only to decide whether the map center moved far enough from the active
// query anchor to surface the "Search this area" affordance, so a cheap
// haversine is plenty (no need for the full CoordinateConverter on this path).
const EARTH_RADIUS_KM = 6371;
export const distanceKm = (a: LatLng, b: LatLng): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Диагональ видимой области в км. Нужна, чтобы порог «значимого сдвига» знал не
// только про радиус поиска, но и про то, сколько на экране вообще помещается.
export const bboxSpanKm = (bbox: MapClusterBBox | null | undefined): number | null => {
  if (!bbox) return null;
  const { south, west, north, east } = bbox;
  if (
    !Number.isFinite(south) ||
    !Number.isFinite(west) ||
    !Number.isFinite(north) ||
    !Number.isFinite(east)
  ) {
    return null;
  }
  const span = distanceKm(
    { latitude: south, longitude: west },
    { latitude: north, longitude: east },
  );
  return Number.isFinite(span) && span > 0 ? span : null;
};

interface UseSearchThisAreaParams {
  mode: string;
  radius: unknown;
  // Пользовательский жест по карте: снимаем «следование за пользователем»
  // (владелец флага — useMapScreenController).
  onUserInitiatedMove?: () => void;
}

export interface UseSearchThisAreaResult {
  searchAreaCenter: LatLng | null;
  setSearchAreaCenter: React.Dispatch<React.SetStateAction<LatLng | null>>;
  mapCenter: LatLng | null;
  canSearchThisArea: boolean;
  handleMapMove: (center: MapMovePayload) => void;
  handleSearchThisArea: () => void;
}

export function useSearchThisArea({
  mode,
  radius,
  onUserInitiatedMove,
}: UseSearchThisAreaParams): UseSearchThisAreaResult {
  // searchAreaCenter — explicit anchor chosen by tapping the floating button;
  // when set it takes priority over userLocation as the nearby-query anchor.
  // mapCenter — the latest center reported by the map on pan/zoom (debounced),
  // used only to decide whether the affordance should appear.
  const [searchAreaCenter, setSearchAreaCenter] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  // settledCenter — where the map came to rest after OUR OWN motion (auto-fit,
  // flyTo, recenter). It is deliberately NOT the query anchor: radius-mode
  // fitBounds reserves room for the bottom sheet with asymmetric padding, so the
  // resting center sits well below the circle center (~36px ≈ 26km at r=50km on
  // mobile). Measuring drift against the anchor therefore reported a huge "move"
  // on the very first frame and pinned the affordance on screen forever, and each
  // tap dragged the search area south of what the user was actually looking at.
  // The baseline is the resting view, so drift now means "the user panned away".
  const [settledCenter, setSettledCenter] = useState<LatLng | null>(null);
  // Диагональ последнего известного вьюпорта: карта присылает bbox вместе с
  // центром (web — Leaflet getBounds, native — мост).
  const [viewportSpanKm, setViewportSpanKm] = useState<number | null>(null);

  const handleMapMove = useCallback((center: MapMovePayload) => {
    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
    const next = { latitude: center.latitude, longitude: center.longitude };
    setMapCenter(next);
    const span = bboxSpanKm(center.bbox);
    if (span != null) setViewportSpanKm(span);
    if (center.userInitiated) {
      onUserInitiatedMove?.();
      // Базовая точка обязана существовать, иначе дрейф не с чем сравнивать и
      // кнопка не появится НИКОГДА. Программный settle бывает не всегда: если
      // геолокация запрещена и авто-fit не отработал, первым же событием
      // приходит жест пользователя. Тогда он и становится точкой отсчёта.
      setSettledCenter((prev) => prev ?? next);
      return;
    }
    // Programmatic settle (Map.web/native only flag gestures as userInitiated):
    // this is the new reference view for the drift check.
    setSettledCenter(next);
  }, [onUserInitiatedMove]);

  // F-49 — threshold for "significant move": the map center must drift away from
  // the resting view by more than ~30% of the active search radius OR ~25% of the
  // visible viewport diagonal, whichever is smaller (clamped to a 1.5–25 km sane
  // band so tiny/huge radii still feel right). Below that the existing results
  // already cover the viewport, so we hide the button.
  //
  // The reference is settledCenter (where our own auto-fit/flyTo left the map),
  // NOT the query anchor: fitBounds intentionally offsets the resting center from
  // the anchor to keep the radius circle clear of the bottom sheet, and that
  // offset is not a user pan.
  const canSearchThisArea = useMemo(() => {
    if (mode !== 'radius') return false;
    if (!mapCenter || !settledCenter) return false;
    const radiusKm = Number(radius) || 30;
    // Один радиус задавал порог плохо: при r=50км это 15км, а на городском зуме
    // весь экран шириной ~11км — сдвинуть карту на целый вид и всё равно не
    // добрать до порога. Кнопки «Искать в этой области» просто не было. Поэтому
    // порог — минимум из «доли радиуса» и «доли видимой области»: как только
    // вид уехал примерно на четверть диагонали экрана, предложение появляется.
    const viewportThresholdKm =
      viewportSpanKm != null ? viewportSpanKm * 0.25 : Number.POSITIVE_INFINITY;
    const thresholdKm = Math.min(
      25,
      Math.max(1.5, Math.min(radiusKm * 0.3, viewportThresholdKm)),
    );
    return distanceKm(settledCenter, mapCenter) > thresholdKm;
  }, [mode, mapCenter, settledCenter, radius, viewportSpanKm]);

  const handleSearchThisArea = useCallback(() => {
    setMapCenter((center) => {
      if (center) {
        setSearchAreaCenter({ latitude: center.latitude, longitude: center.longitude });
        // The panned-to view IS the view the user asked to search: adopt it as the
        // baseline right away so the affordance retracts on tap even when the
        // re-anchored fit lands on the same view and reports no fresh settle.
        setSettledCenter({ latitude: center.latitude, longitude: center.longitude });
      }
      return center;
    });
  }, []);

  return {
    searchAreaCenter,
    setSearchAreaCenter,
    mapCenter,
    canSearchThisArea,
    handleMapMove,
    handleSearchThisArea,
  };
}
