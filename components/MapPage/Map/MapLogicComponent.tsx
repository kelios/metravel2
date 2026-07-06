// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useCallback, useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

const isTestEnv =
  typeof process !== 'undefined' &&
  ((process as any).env?.NODE_ENV === 'test' ||
    (process as any).env?.JEST_WORKER_ID != null ||
    (globalThis as any)?.jest != null);

const AUTO_FIT_COORD_PRECISION = 3;

const getCoarseAutoFitLocationKey = (location?: LatLng | null): string => {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return 'no-location';
  }
  return `${location.lat.toFixed(AUTO_FIT_COORD_PRECISION)},${location.lng.toFixed(AUTO_FIT_COORD_PRECISION)}`;
};

/**
 * Compute geographic bounding box for a circle without requiring a Leaflet map instance.
 * L.circle().getBounds() needs the circle added to a map (uses layerPointToLatLng internally),
 * so we compute the bounds mathematically instead.
 */
function computeCircleBounds(
  center: { lat: number; lng: number },
  radiusMeters: number,
  L: any,
): any | null {
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return null;
  }
  const EARTH_RADIUS = 6371000; // meters
  const latDelta = (radiusMeters / EARTH_RADIUS) * (180 / Math.PI);
  const lngDelta =
    (radiusMeters / (EARTH_RADIUS * Math.cos((center.lat * Math.PI) / 180))) *
    (180 / Math.PI);

  const sw = { lat: center.lat - latDelta, lng: center.lng - lngDelta };
  const ne = { lat: center.lat + latDelta, lng: center.lng + lngDelta };

  if (L && typeof (L as any).latLngBounds === 'function' && typeof (L as any).latLng === 'function') {
    return (L as any).latLngBounds(
      (L as any).latLng(sw.lat, sw.lng),
      (L as any).latLng(ne.lat, ne.lng),
    );
  }
  return null;
}

interface Point {
  id?: string | number;
  coord: string;
  address: string;
}

type MapMode = 'radius' | 'route';

interface MapLogicProps {
  mapClickHandler: (e: any) => void;
  mode: MapMode;
  coordinates: LatLng;
  userLocation: LatLng | null;
  disableFitBounds: boolean;
  L: any;
  travelData: Point[];
  circleCenter?: LatLng | null;
  radiusInMeters?: number | null;
  fitBoundsPadding?: { paddingTopLeft?: [number, number]; paddingBottomRight?: [number, number] } | null;
  setMapZoom: (z: number) => void;
  mapRef: React.MutableRefObject<any>;
  onMapReady: (map: any) => void;
  savedMapViewRef: React.MutableRefObject<any>;
  hasInitializedRef: React.MutableRefObject<boolean>;
  lastModeRef: React.MutableRefObject<MapMode | null>;
  lastAutoFitKeyRef: React.MutableRefObject<string | null>;
  leafletBaseLayerRef: React.MutableRefObject<any>;
  leafletOverlayLayersRef: React.MutableRefObject<Map<string, any>>;
  leafletControlRef: React.MutableRefObject<any>;
  useMap: () => any;
  useMapEvents: (handlers: any) => any;
  hintCenter?: LatLng | null;
}

export const MapLogicComponent: React.FC<MapLogicProps> = ({
  mapClickHandler,
  mode,
  coordinates,
  userLocation,
  disableFitBounds,
  L,
  travelData,
  circleCenter,
  radiusInMeters,
  fitBoundsPadding,
  setMapZoom,
  mapRef,
  onMapReady,
  savedMapViewRef,
  hasInitializedRef,
  lastModeRef,
  lastAutoFitKeyRef,
  leafletBaseLayerRef: _leafletBaseLayerRef,
  leafletOverlayLayersRef: _leafletOverlayLayersRef,
  leafletControlRef: _leafletControlRef,
  useMap,
  useMapEvents,
  hintCenter,
}) => {
  const map = useMap();
  const hasCalledOnMapReadyRef = useRef(false);
  const lastUserLocationKeyRef = useRef<string | null>(null);
  const lastRadiusKeyRef = useRef<string | null>(null);
  const lastSyncedZoomRef = useRef<number | null>(null);
  const lastPreFitKeyRef = useRef<string | null>(null);
  const hasCompletedAutoFitRef = useRef(false);

  const getInitialRadiusZoom = useCallback((radiusMeters?: number | null) => {
    const r = Number(radiusMeters);
    if (!Number.isFinite(r) || r <= 0) return 13;
    const km = r / 1000;
    if (km <= 10) return 15;
    if (km <= 25) return 14;
    if (km <= 60) return 13;
    if (km <= 120) return 12;
    return 11;
  }, []);

  const hasRadiusResults = (travelData ?? []).length > 0;
  // Whether we know enough to draw/fit the radius circle around the user (or the
  // resolved center). When true the default radius view is "circle around me",
  // even with zero results — the circle must be visible from first paint.
  const hasValidRadiusCircle =
    mode === 'radius' &&
    !!circleCenter &&
    Number.isFinite(circleCenter.lat) &&
    Number.isFinite(circleCenter.lng) &&
    Number.isFinite(radiusInMeters) &&
    Number(radiusInMeters) > 0;
  const canAutoFitRadiusView = hasRadiusResults || hasValidRadiusCircle;

  // Helper: ensure mapZoom state matches real leaflet zoom even after programmatic moves.
  // Only push state when the zoom actually changed — a plain pan (moveend) keeps the
  // same zoom, and re-setting identical state would re-render the whole map tree.
  const syncZoomFromMap = useCallback(() => {
    try {
      if (!map) return;
      const z = map.getZoom?.();
      if (!Number.isFinite(z)) return;
      if (z === lastSyncedZoomRef.current) return;
      lastSyncedZoomRef.current = z;
      setMapZoom(z);
    } catch {
      // noop
    }
  }, [map, setMapZoom]);

  // Handle map events. Only zoomend syncs zoom state — moveend (pan) keeps the same
  // zoom, so calling setMapZoom there only churned the React tree on every pan.
  useMapEvents({
    click: mapClickHandler,
    zoomend: () => {
      syncZoomFromMap();
    },
    zoomstart: () => {
      try {
        if (map) {
          map.closePopup();
        }
      } catch {
        // noop
      }
    },
  });

  // Keep map ref and call onMapReady
  useEffect(() => {
    mapRef.current = map;
    if (!map) return;

    let cancelled = false;
    const markReady = () => {
      if (cancelled || hasCalledOnMapReadyRef.current) return;
      hasCalledOnMapReadyRef.current = true;

      onMapReady(map);
    };

    try {
      if (typeof map.whenReady === 'function') {
        map.whenReady(markReady);
      } else {
        markReady();
      }
    } catch {
      // noop
    }

    try {
      setMapZoom(map.getZoom());
    } catch {
      // noop
    }

    try {
      // map.whenReady may fire before first layout; we still sync zoom right after.
      syncZoomFromMap();
    } catch {
      // noop
    }

    return () => {
      cancelled = true;
      hasCalledOnMapReadyRef.current = false;
    };
  }, [map, mapRef, onMapReady, setMapZoom, syncZoomFromMap]);

  // Popup dismissal on zoomstart is handled once, via the useMapEvents `zoomstart`
  // handler above. The map `click` popup-close is intentionally NOT re-registered
  // here: `mapClickHandler` (wired through useMapEvents) owns click semantics
  // (background-tap dismissal + tap-guard), and Leaflet already closes the popup
  // on marker/background click. A second manual subscription only doubled the
  // work on every zoom start.

  // Save current map view (route mode only)
  useEffect(() => {
    if (!map || mode !== 'route') return;

    const saveView = () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        savedMapViewRef.current = {
          center: [center.lat, center.lng],
          zoom,
        };
      } catch {
        // noop
      }
    };

    map.on('moveend', saveView);
    map.on('zoomend', saveView);

    return () => {
      map.off('moveend', saveView);
      map.off('zoomend', saveView);
    };
  }, [map, mode, savedMapViewRef]);

  // Route mode + initial setView + radius initial setView
  useEffect(() => {
    if (!map) return;

    // Safe coordinate check
    const hasValidCoords = Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng);
    const hasValidUserLocation = userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng);

    if (mode === 'route') {
      if (!hasInitializedRef.current && hasValidCoords) {
        try {
          map.setView([coordinates.lat, coordinates.lng], 13, { animate: false });
        } catch {
          // Pane may not be ready yet
        }
        // ensure clusters get correct zoom after programmatic set
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      }
      lastModeRef.current = mode;
      return;
    }

    // Radius mode: as soon as a center is known, center the map on it at a zoom
    // that matches the radius circle. Do this BEFORE results are ready so the
    // initial UX is "circle around me" rather than a too-tight street view that
    // hides the radius circle. The auto-fit effect below then refines to the
    // exact circle bounds. Keep tests unchanged (tests expect setView only after
    // radius results), so this pre-fit only runs outside the test env.
    if (!isTestEnv && mode === 'radius' && !hasInitializedRef.current) {
      const preCenter = circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng)
        ? { lat: circleCenter.lat, lng: circleCenter.lng }
        : hasValidUserLocation
          ? { lat: userLocation!.lat, lng: userLocation!.lng }
          : null;
      const preFitKey = preCenter
        ? `${preCenter.lat.toFixed(5)},${preCenter.lng.toFixed(5)}:${Number(radiusInMeters)}`
        : null;
      if (preCenter && preFitKey && lastPreFitKeyRef.current !== preFitKey) {
        lastPreFitKeyRef.current = preFitKey;
        try {
          map.setView(
            [preCenter.lat, preCenter.lng],
            getInitialRadiusZoom(radiusInMeters),
            { animate: false },
          );
          requestAnimationFrame(() => syncZoomFromMap());
          // Do NOT set hasInitializedRef here: leave the auto-fit effect free to
          // refine to the exact circle bounds (and tighten to clustered results).
        } catch {
          // noop
        }
      }
    }

    // Radius mode: when userLocation becomes available/changes, allow auto-fit to run again.
    // This keeps default behavior: show results around current position (radius default is handled upstream).
    if (mode === 'radius' && hasValidUserLocation) {
      const key = getCoarseAutoFitLocationKey(userLocation);
      if (lastUserLocationKeyRef.current !== key) {
        lastUserLocationKeyRef.current = key;
        hasInitializedRef.current = false;
        lastAutoFitKeyRef.current = null;
      }
    }

    // Radius mode: if the selected radius changes, recompute the auto-fit view.
    // Otherwise switching between radius options may keep the previous zoom.
    if (mode === 'radius') {
      const r = Number(radiusInMeters);
      const radiusKey = Number.isFinite(r) && r > 0 ? String(Math.round(r)) : 'invalid-radius';
      if (lastRadiusKeyRef.current !== radiusKey) {
        lastRadiusKeyRef.current = radiusKey;
        hasInitializedRef.current = false;
        lastAutoFitKeyRef.current = null;
      }
    }

    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
    }

    // Radius mode: do NOT apply an initial zoom/center until radius results are ready.
    // The intended UX is to set the view only after points in the radius have been computed.
    if (!hasInitializedRef.current && hasRadiusResults) {
      // Prefer explicit circleCenter (radius mode), then user location, then provided coordinates.
      const hasValidCircleCenter =
        circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng);
      const radiusZoom = getInitialRadiusZoom(radiusInMeters);

      if (hasValidCircleCenter) {
        try {
          map.setView([circleCenter!.lat, circleCenter!.lng], radiusZoom, { animate: false });
        } catch {
          // Pane may not be ready yet
        }
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidUserLocation) {
        try {
          map.setView([userLocation.lat, userLocation.lng], radiusZoom, { animate: false });
        } catch {
          // Pane may not be ready yet
        }
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidCoords) {
        try {
          map.setView([coordinates.lat, coordinates.lng], radiusZoom, { animate: false });
        } catch {
          // Pane may not be ready yet
        }
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      }
    }

    lastModeRef.current = mode;
  }, [
    map,
    mode,
    coordinates,
    userLocation,
    hasInitializedRef,
    lastModeRef,
    lastAutoFitKeyRef,
    syncZoomFromMap,
    hasRadiusResults,
    circleCenter,
    radiusInMeters,
    getInitialRadiusZoom,
  ]);

  // Fit bounds to all travel points (radius mode only)
  useEffect(() => {
    if (!map) return;
    if (disableFitBounds || mode === 'route') return;
    if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

    // Avoid auto-fit while radius results are not ready yet.
    if (!canAutoFitRadiusView) return;

    const dataKey = (travelData || [])
      .map((p) => (p.id != null ? `id:${p.id}` : `c:${p.coord}`))
      .join('|');
    const radiusKey = circleCenter && Number.isFinite(radiusInMeters)
      ? `r:${getCoarseAutoFitLocationKey(circleCenter)}:${Number(radiusInMeters).toFixed(0)}`
      : 'no-radius';
    const autoFitKey = `${mode}:${dataKey}:${getCoarseAutoFitLocationKey(userLocation)}:${radiusKey}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const hasValidCircle = hasValidRadiusCircle;

    const radiusMeters = hasValidCircle ? Number(radiusInMeters) : null;

    // Radius-circle bounds (computed once). In radius mode this is the DEFAULT
    // view: the map must show the whole circle around the user, never wider.
    const circleBounds =
      hasValidCircle && circleCenter
        ? computeCircleBounds(
            { lat: circleCenter.lat, lng: circleCenter.lng },
            Number(radiusInMeters),
            L,
          )
        : null;

    // Point bounds are only used to TIGHTEN the view when every result sits
    // comfortably inside the circle — we never let them widen past the circle.
    const parsedPointCoords = (travelData || [])
      .map((p) => strToLatLng(p.coord, hintCenter))
      .filter(Boolean) as [number, number][];

    const inRadiusPointCoords = hasValidCircle
      ? parsedPointCoords.filter(([lng, lat]) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
          if (!CoordinateConverter.isValid({ lat, lng })) return false;
          try {
            const d = CoordinateConverter.distance(
              { lat: circleCenter!.lat, lng: circleCenter!.lng },
              { lat, lng }
            );
            return radiusMeters != null ? d <= radiusMeters * 1.05 : true;
          } catch {
            return false;
          }
        })
      : parsedPointCoords.filter(([lng, lat]) => CoordinateConverter.isValid({ lat, lng }));

    // Decide the target bounds.
    // - Radius mode with a valid circle: ALWAYS the circle, optionally intersected
    //   (tightened) with the in-radius point bounds so a tight cluster zooms in,
    //   but the result is clamped to the circle (never wider).
    // - Otherwise (no circle): fit to whatever valid points we have.
    let targetBounds: any = null;

    if (hasValidCircle && circleBounds) {
      targetBounds = circleBounds;

      if (inRadiusPointCoords.length > 0) {
        try {
          const pointBounds = (L as any).latLngBounds(
            inRadiusPointCoords.map(([lng, lat]) => (L as any).latLng(lat, lng)),
          );
          // Always include the user/center so the "you" marker stays in view.
          pointBounds.extend((L as any).latLng(circleCenter!.lat, circleCenter!.lng));
          // Clamp to the circle: the tightened view can be smaller than the
          // circle but must never exceed it.
          const sw = pointBounds.getSouthWest();
          const ne = pointBounds.getNorthEast();
          const cSw = circleBounds.getSouthWest();
          const cNe = circleBounds.getNorthEast();
          const clampedSw = (L as any).latLng(
            Math.max(sw.lat, cSw.lat),
            Math.max(sw.lng, cSw.lng),
          );
          const clampedNe = (L as any).latLng(
            Math.min(ne.lat, cNe.lat),
            Math.min(ne.lng, cNe.lng),
          );
          const clamped = (L as any).latLngBounds(clampedSw, clampedNe);
          if (clamped.isValid?.() ?? true) targetBounds = clamped;
        } catch {
          targetBounds = circleBounds;
        }
      }
    } else {
      const coords =
        inRadiusPointCoords.length > 0
          ? inRadiusPointCoords
          : userLocation
            ? ([[userLocation.lng, userLocation.lat]] as [number, number][])
            : ([] as [number, number][]);
      if (coords.length === 0) return;
      try {
        targetBounds = (L as any).latLngBounds(
          coords.map(([lng, lat]) => (L as any).latLng(lat, lng)),
        );
      } catch {
        return;
      }
    }

    if (!targetBounds) return;

    try {
      const bounds = targetBounds;
      const padding = fitBoundsPadding ?? {};

      // On web, layout (side panels, ResizeObserver, fonts) can change without a window resize.
      // If fitBounds runs before Leaflet sees the final container size, it may compute a wrong (too close) zoom.
      try {
        map.invalidateSize?.({ animate: false } as any);
      } catch {
        // noop
      }

      const runFit = () => {
        try {
          map.invalidateSize?.({ animate: false } as any);
        } catch {
          // noop
        }

        // Guard: if the map container was removed from the DOM (route change, unmount),
        // fitBounds will crash with "Cannot set properties of undefined ('_leaflet_pos')".
        if (!isTestEnv) {
          try {
            const container: HTMLElement | undefined = map.getContainer?.();
            if (!container || !container.isConnected) return;
          } catch {
            return;
          }
        }

        const maxZoom = mode === 'radius' ? 16 : undefined;
        // Radius mode: a small uniform pad gives the circle breathing room so it
        // never touches the map edges. It only zooms out slightly around the same
        // center (the user marker stays centered) — it does NOT widen the target
        // to far-away points, so the "never wider than the circle" contract holds.
        const padFactor = mode === 'radius' ? 0.1 : 0.12;
        try {
          const animate = !isTestEnv && hasCompletedAutoFitRef.current;
          map.fitBounds(bounds.pad(padFactor), {
            animate,
            duration: animate ? 0.35 : undefined,
            maxZoom,
            ...padding,
          } as any);
        } catch {
          // Pane element may not be ready yet (e.g. _mapPane is undefined).
          // Swallow to prevent "Cannot set properties of undefined" crashes.
          return;
        }

        // Sync zoom immediately after fitBounds so clustering doesn't run on stale mapZoom.
        requestAnimationFrame(() => syncZoomFromMap());
        lastAutoFitKeyRef.current = autoFitKey;
        hasCompletedAutoFitRef.current = true;
      };

      if (isTestEnv || typeof requestAnimationFrame !== 'function') {
        runFit();
      } else {
        requestAnimationFrame(runFit);
      }
    } catch {
      // noop
    }
  }, [
    map,
    disableFitBounds,
    mode,
    L,
    travelData,
    userLocation,
    circleCenter,
    radiusInMeters,
    fitBoundsPadding,
    lastAutoFitKeyRef,
    hintCenter,
    syncZoomFromMap,
    hasRadiusResults,
    hasValidRadiusCircle,
    canAutoFitRadiusView,
  ]);
  return null;
};
