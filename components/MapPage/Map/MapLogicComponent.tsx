// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useEffect, useRef } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { LatLng } from '@/types/coordinates';

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
}

const strToLatLng = (s: string): [number, number] | null => {
  const parsed = CoordinateConverter.fromLooseString(s);
  if (!parsed) return null;
  if (!CoordinateConverter.isValid(parsed)) return null;
  return [parsed.lng, parsed.lat];
};

export const MapLogicComponent: React.FC<MapLogicProps> = ({
  mapClickHandler,
  mode,
  coordinates,
  userLocation,
  disableFitBounds,
  L,
  travelData,
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
}) => {
  const map = useMap();
  const hasCalledOnMapReadyRef = useRef(false);

  // Handle map events
  useMapEvents({
    click: mapClickHandler,
    zoomend: () => {
      try {
        if (map) {
          const z = map.getZoom();
          setMapZoom(z);
        }
      } catch {
        // noop
      }
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

    return () => {
      cancelled = true;
      hasCalledOnMapReadyRef.current = false;
    };
  }, [map, mapRef, onMapReady, setMapZoom]);

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

  // Route mode: keep map stable (no auto fitBounds)
  useEffect(() => {
    if (!map) return;

    // Safe coordinate check
    const hasValidCoords = Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng);
    const hasValidUserLocation = userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng);

    if (mode === 'route') {
      if (!hasInitializedRef.current && hasValidCoords) {
        map.setView([coordinates.lat, coordinates.lng], 13, { animate: false });
        hasInitializedRef.current = true;
      }
      lastModeRef.current = mode;
      return;
    }

    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
    }

    if (!hasInitializedRef.current) {
      if (hasValidUserLocation) {
        map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
        hasInitializedRef.current = true;
      } else if (hasValidCoords) {
        map.setView([coordinates.lat, coordinates.lng], 11, { animate: false });
        hasInitializedRef.current = true;
      }
    }

    lastModeRef.current = mode;
  }, [map, mode, coordinates, userLocation, hasInitializedRef, lastModeRef]);

  // Fit bounds to all travel points (radius mode only)
  useEffect(() => {
    if (!map) return;
    if (disableFitBounds || mode === 'route') return;
    if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

    const dataKey = (travelData || [])
      .map((p) => (p.id != null ? `id:${p.id}` : `c:${p.coord}`))
      .join('|');
    const autoFitKey = `${mode}:${dataKey}:${userLocation ? `${userLocation.lat},${userLocation.lng}` : 'no-user'}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const coords = travelData
      .map((p) => strToLatLng(p.coord))
      .filter(Boolean) as [number, number][];

    if (coords.length === 0 && userLocation) {
      coords.push([userLocation.lng, userLocation.lat]);
    }

    if (coords.length === 0) return;

    try {
      const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
      map.fitBounds(bounds.pad(0.2), { animate: false });
      lastAutoFitKeyRef.current = autoFitKey;
    } catch {
      // noop
    }
  }, [map, disableFitBounds, mode, L, travelData, userLocation, lastAutoFitKeyRef]);

  return null;
};
