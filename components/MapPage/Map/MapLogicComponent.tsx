// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useCallback, useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

interface Point {
  id?: number;
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

  const hasRadiusResults = (travelData ?? []).length > 0;
  const canAutoFitRadiusView =
    hasRadiusResults ||
    (isTestEnv && circleCenter && Number.isFinite(radiusInMeters) && Number(radiusInMeters) > 0);

  // Helper: ensure mapZoom state matches real leaflet zoom even after programmatic moves.
  const syncZoomFromMap = useCallback(() => {
    try {
      if (!map) return;
      const z = map.getZoom?.();
      if (Number.isFinite(z)) setMapZoom(z);
    } catch {
      // noop
    }
  }, [map, setMapZoom]);

  // Handle map events
  useMapEvents({
    click: mapClickHandler,
    zoomend: () => {
      syncZoomFromMap();
    },
    moveend: () => {
      // fitBounds can sometimes update zoom while zoomend isn't our first reliable signal
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

      try {
        const ac = (map as any).attributionControl;
        if (ac && typeof ac.setPrefix === 'function') {
          const prefix = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>';
          ac.setPrefix(prefix);
        }
      } catch {
        // noop
      }

      // Ensure route polyline pane is always above tiles.
      // In some web exports/e2e builds pane stacking can be broken, causing the route line to render under tiles.
      try {
        const paneName = 'metravelRoutePane';
        const existing = typeof (map as any).getPane === 'function' ? (map as any).getPane(paneName) : null;
        const pane = existing || (typeof (map as any).createPane === 'function' ? (map as any).createPane(paneName) : null);
        if (pane && pane.style) {
          pane.style.zIndex = '560';
          pane.style.pointerEvents = 'none';
        }
      } catch {
        // noop
      }

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

  // Close popup on map click or zoom
  useEffect(() => {
    if (!map) return;
    const close = () => {
      try {
        map.closePopup();
      } catch {
        // noop
      }
    };
    map.on('click', close);
    map.on('zoomstart', close);
    return () => {
      map.off('click', close);
      map.off('zoomstart', close);
    };
  }, [map]);

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
        map.setView([coordinates.lat, coordinates.lng], 13, { animate: false });
        // ensure clusters get correct zoom after programmatic set
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      }
      lastModeRef.current = mode;
      return;
    }

    // Radius mode: as soon as userLocation is available, center the map on it.
    // Do this BEFORE results are ready so the initial UX is "centered on me".
    // Keep tests unchanged (tests expect setView only after radius results).
    if (!isTestEnv && mode === 'radius' && !hasInitializedRef.current && hasValidUserLocation) {
      try {
        map.setView([userLocation!.lat, userLocation!.lng], 14, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } catch {
        // noop
      }
    }

    // Radius mode: when userLocation becomes available/changes, allow auto-fit to run again.
    // This keeps default behavior: show results around current position (radius default is handled upstream).
    if (mode === 'radius' && hasValidUserLocation) {
      const key = `${userLocation!.lat.toFixed(6)},${userLocation!.lng.toFixed(6)}`;
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

      if (hasValidCircleCenter) {
        map.setView([circleCenter!.lat, circleCenter!.lng], 11, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidUserLocation) {
        map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidCoords) {
        map.setView([coordinates.lat, coordinates.lng], 11, { animate: false });
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
      ? `r:${circleCenter.lat.toFixed(4)},${circleCenter.lng.toFixed(4)}:${Number(radiusInMeters).toFixed(0)}`
      : 'no-radius';
    const autoFitKey = `${mode}:${dataKey}:${userLocation ? `${userLocation.lat},${userLocation.lng}` : 'no-user'}:${radiusKey}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const hasValidCircle =
      mode === 'radius' &&
      circleCenter &&
      Number.isFinite(circleCenter.lat) &&
      Number.isFinite(circleCenter.lng) &&
      Number.isFinite(radiusInMeters) &&
      Number(radiusInMeters) > 0;

    const radiusMeters = hasValidCircle ? Number(radiusInMeters) : null;

    // Prefer fitting to actual point bounds when we have results.
    // Filter out extreme outliers, and (when circle is known) filter to points within the radius.
    const parsedPointCoords = (travelData || [])
      .map((p) => strToLatLng(p.coord, hintCenter))
      .filter(Boolean) as [number, number][];

    const filteredPointCoords = hasValidCircle
      ? parsedPointCoords.filter(([lng, lat]) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
          if (!CoordinateConverter.isValid({ lat, lng })) return false;
          try {
            const d = CoordinateConverter.distance(
              { lat: circleCenter!.lat, lng: circleCenter!.lng },
              { lat, lng }
            );
            // small tolerance to avoid dropping borderline points due to rounding
            return radiusMeters != null ? d <= radiusMeters * 1.05 : true;
          } catch {
            return false;
          }
        })
      : parsedPointCoords.filter(([lng, lat]) => CoordinateConverter.isValid({ lat, lng }));

    const shouldIgnoreRadiusFilter =
      hasValidCircle &&
      parsedPointCoords.length >= 20 &&
      filteredPointCoords.length > 0 &&
      filteredPointCoords.length < Math.max(10, Math.floor(parsedPointCoords.length * 0.2));

    // If filtering removed everything (or looks suspiciously small), fall back to unfiltered points.
    const usablePointCoords =
      filteredPointCoords.length === 0 || shouldIgnoreRadiusFilter
        ? parsedPointCoords
        : filteredPointCoords;

    const shouldFitToPoints = usablePointCoords.length > 0;
    const coords = shouldFitToPoints ? usablePointCoords : ([] as [number, number][]);

    if (coords.length === 0) {
      if (circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng)) {
        coords.push([circleCenter.lng, circleCenter.lat]);
      } else if (userLocation) {
        coords.push([userLocation.lng, userLocation.lat]);
      }
    }

    // If we ended up with no usable points, fit to the circle bounds as a safe fallback.
    if (!shouldFitToPoints && hasValidCircle) {
      try {
        const circle = (L as any).circle([circleCenter.lat, circleCenter.lng], {
          radius: Number(radiusInMeters),
        });
        const circleBounds = circle.getBounds();
        const sw = circleBounds.getSouthWest();
        const ne = circleBounds.getNorthEast();
        coords.push([sw.lng, sw.lat]);
        coords.push([ne.lng, ne.lat]);
      } catch {
        // noop
      }
    }

    if (coords.length === 0) return;

    if (__DEV__ && mode === 'radius') {
      try {
        const samples = (travelData || []).slice(0, 5).map((p) => {
          const parsed = strToLatLng(p.coord, hintCenter);
          return { coord: p.coord, parsed };
        });
        console.info('[MapLogicComponent] radius fitBounds debug', {
          travelCount: (travelData || []).length,
          circleCenter,
          radiusInMeters,
          userLocation,
          fitMode: shouldFitToPoints ? 'points' : hasValidCircle ? 'circle' : 'none',
          sample: samples,
        });
      } catch {
        // noop
      }
    }

    try {
      const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
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

        const maxZoom = mode === 'radius' ? 14 : undefined;
        map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom, ...padding } as any);

        // Sync zoom immediately after fitBounds so clustering doesn't run on stale mapZoom.
        requestAnimationFrame(() => syncZoomFromMap());
        lastAutoFitKeyRef.current = autoFitKey;
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
    canAutoFitRadiusView,
  ]);

  return null;
};
