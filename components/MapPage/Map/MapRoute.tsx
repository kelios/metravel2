import React, { useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';

interface MapRouteProps {
  map: any;
  routeCoordinates: LatLng[];
  isOptimal: boolean;
}

const MapRoute: React.FC<MapRouteProps> = ({
  map,
  routeCoordinates,
  isOptimal,
}) => {
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const L = (window as any).L;
    if (!L) return;

    // Remove old polyline
    if (polylineRef.current) {
      try {
        map.removeLayer(polylineRef.current);
      } catch (_error) {
        console.warn('Error removing polyline:', _error);
      }
      polylineRef.current = null;
    }

    // Draw new polyline if we have coordinates
    if (routeCoordinates.length >= 2) {
      const latlngs = routeCoordinates.map(coord =>
        L.latLng(coord.lat, coord.lng)
      );

      // Determine line style based on route status
      const color = isOptimal ? '#3388ff' : '#ff9800';
      const weight = isOptimal ? 5 : 4;
      const opacity = isOptimal ? 0.85 : 0.65;
      const dashArray = isOptimal ? null : '10, 10';

      const line = L.polyline(latlngs, {
        color,
        weight,
        opacity,
        dashArray,
        lineJoin: 'round',
        lineCap: 'round',
      });

      line.addTo(map);
      polylineRef.current = line;

      // Center map on route
      try {
        const bounds = line.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.1), {
            animate: true,
            duration: 0.5,
            maxZoom: 14,
          });
        }
      } catch (error) {
        console.warn('Error centering on route:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // Ignore cleanup errors
        }
        polylineRef.current = null;
      }
    };
  }, [map, routeCoordinates, isOptimal]);

  return null;
};

export default React.memo(MapRoute);
