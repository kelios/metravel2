import { useEffect, useRef, useState, useCallback } from 'react';
import type { LatLng } from '@/types/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';

interface UseMapLogicProps {
  map: any;
  mode: 'radius' | 'route';
  coordinates: LatLng;
  userLocation: LatLng | null;
  travelData: any[];
  disableFitBounds: boolean;
}

export function useMapLogic({
  map,
  mode,
  coordinates,
  userLocation,
  travelData,
  disableFitBounds,
}: UseMapLogicProps) {
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<'radius' | 'route' | null>(null);
  const [hasCenteredOnData, setHasCenteredOnData] = useState(false);

  // Center on user location on first load
  useEffect(() => {
    if (!map) return;

    // In route mode, never auto-center - user selects points manually
    if (mode === 'route') {
      if (!hasInitializedRef.current && coordinates.lat && coordinates.lng) {
        map.setView(
          CoordinateConverter.toLeaflet(coordinates),
          13,
          { animate: false }
        );
        hasInitializedRef.current = true;
      }
      lastModeRef.current = mode;
      return;
    }

    // Reset initialization flag when switching from route to radius
    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
    }

    // Only for radius mode - center on first load
    if (!hasInitializedRef.current) {
      if (userLocation) {
        map.setView(
          CoordinateConverter.toLeaflet(userLocation),
          11,
          { animate: false }
        );
        hasInitializedRef.current = true;
      } else if (coordinates.lat && coordinates.lng) {
        map.setView(
          CoordinateConverter.toLeaflet(coordinates),
          11,
          { animate: false }
        );
        hasInitializedRef.current = true;
      }
    }

    lastModeRef.current = mode;
  }, [map, mode, coordinates, userLocation]);

  // Auto-fit bounds to data points
  useEffect(() => {
    if (!map || disableFitBounds || mode === 'route') return;
    if (typeof window === 'undefined') return;

    const L = (window as any).L;
    if (!L || typeof L.latLngBounds !== 'function') return;

    const points: LatLng[] = [];

    // Add travel points
    if (travelData.length > 0) {
      travelData.forEach(point => {
        try {
          if (point.coord) {
            const coords = CoordinateConverter.fromString(point.coord);
            points.push(coords);
          }
        } catch {
          // Skip invalid coordinates
        }
      });
    }

    // Fallback to user location
    if (points.length === 0 && userLocation) {
      points.push(userLocation);
    }

    if (points.length > 0) {
      const leafletPoints = points.map(p => L.latLng(p.lat, p.lng));
      const bounds = L.latLngBounds(leafletPoints);
      map.fitBounds(bounds.pad(0.2), { animate: !hasCenteredOnData });
      setHasCenteredOnData(true);
    }
  }, [map, travelData, userLocation, disableFitBounds, mode, hasCenteredOnData]);

  const centerOnUserLocation = useCallback(() => {
    if (!map || !userLocation) return;
    map.setView(
      CoordinateConverter.toLeaflet(userLocation),
      13,
      { animate: true }
    );
  }, [map, userLocation]);

  return {
    centerOnUserLocation,
  };
}
