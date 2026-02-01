// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useCallback, useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';
import { strToLatLng } from './utils';

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

    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
    }

    if (!hasInitializedRef.current) {
      if (hasValidUserLocation) {
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
  }, [map, mode, coordinates, userLocation, hasInitializedRef, lastModeRef, lastAutoFitKeyRef, syncZoomFromMap]);

  // Fit bounds to all travel points (radius mode only)
  useEffect(() => {
    if (!map) return;
    if (disableFitBounds || mode === 'route') return;
    if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

    const dataKey = (travelData || [])
      .map((p) => (p.id != null ? `id:${p.id}` : `c:${p.coord}`))
      .join('|');
    const radiusKey = circleCenter && Number.isFinite(radiusInMeters)
      ? `r:${circleCenter.lat.toFixed(4)},${circleCenter.lng.toFixed(4)}:${Number(radiusInMeters).toFixed(0)}`
      : 'no-radius';
    const autoFitKey = `${mode}:${dataKey}:${userLocation ? `${userLocation.lat},${userLocation.lng}` : 'no-user'}:${radiusKey}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const coords = travelData
      .map((p) => strToLatLng(p.coord, hintCenter))
      .filter(Boolean) as [number, number][];

    if (coords.length === 0) {
      if (circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng)) {
        coords.push([circleCenter.lng, circleCenter.lat]);
      } else if (userLocation) {
        coords.push([userLocation.lng, userLocation.lat]);
      }
    }

    if (circleCenter && Number.isFinite(radiusInMeters) && Number(radiusInMeters) > 0) {
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

    try {
      const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
      const padding = fitBoundsPadding ?? {};
      map.fitBounds(bounds.pad(0.2), { animate: false, ...padding });
      // Sync zoom immediately after fitBounds so clustering doesn't run on stale mapZoom.
      requestAnimationFrame(() => syncZoomFromMap());
      lastAutoFitKeyRef.current = autoFitKey;
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
  ]);

  return null;
};
