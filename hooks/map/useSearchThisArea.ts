import { useCallback, useMemo, useState } from 'react';

import type { MapMovePayload } from '@/components/MapPage/Map/types';

// F-49 — "Search this area" (Google/Organic-Maps style). Извлечено из
// useMapScreenController без изменения поведения (формула/пороги идентичны).

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

  const handleMapMove = useCallback((center: MapMovePayload) => {
    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
    setMapCenter({ latitude: center.latitude, longitude: center.longitude });
    if (center.userInitiated) {
      onUserInitiatedMove?.();
      return;
    }
    // Programmatic settle (Map.web/native only flag gestures as userInitiated):
    // this is the new reference view for the drift check.
    setSettledCenter({ latitude: center.latitude, longitude: center.longitude });
  }, [onUserInitiatedMove]);

  // F-49 — threshold for "significant move": the map center must drift away from
  // the resting view by more than ~30% of the active search radius (clamped to a
  // 1.5–25 km sane band so tiny/huge radii still feel right). Below that the
  // existing results already cover the viewport, so we hide the button.
  //
  // The reference is settledCenter (where our own auto-fit/flyTo left the map),
  // NOT the query anchor: fitBounds intentionally offsets the resting center from
  // the anchor to keep the radius circle clear of the bottom sheet, and that
  // offset is not a user pan. Until the map reports its first settle we have no
  // baseline, so there is nothing to have drifted from.
  const canSearchThisArea = useMemo(() => {
    if (mode !== 'radius') return false;
    if (!mapCenter || !settledCenter) return false;
    const radiusKm = Number(radius) || 30;
    const thresholdKm = Math.min(25, Math.max(1.5, radiusKm * 0.3));
    return distanceKm(settledCenter, mapCenter) > thresholdKm;
  }, [mode, mapCenter, settledCenter, radius]);

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
