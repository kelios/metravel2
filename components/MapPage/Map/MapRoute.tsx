import React, { useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';
import { useThemedColors } from '@/hooks/useTheme';

interface MapRouteProps {
  map: any;
  leaflet?: any;
  routeCoordinates: LatLng[];
  isOptimal: boolean;
  disableFitBounds?: boolean;
}

const MapRoute: React.FC<MapRouteProps> = ({
  map,
  leaflet: leafletFromProps,
  routeCoordinates,
  isOptimal,
  disableFitBounds,
}) => {
  const polylineRef = useRef<any>(null);
  const { primary, danger } = useThemedColors();

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const leaflet = leafletFromProps ?? (window as any).L;
    if (!leaflet) return;

    let cancelled = false;

    // Remove old polyline
    if (polylineRef.current) {
      try {
        map.removeLayer(polylineRef.current);
      } catch (_error) {
        console.warn('Error removing polyline:', _error);
      }
      polylineRef.current = null;
    }

    const validCoords = (routeCoordinates || []).filter((c) => {
      const lat = (c as any)?.lat;
      const lng = (c as any)?.lng;
      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    });

    if (validCoords.length < 2) {
      return () => {
        cancelled = true;
        if (polylineRef.current && map) {
          try {
            map.removeLayer(polylineRef.current);
          } catch {
            // Ignore cleanup errors
          }
          polylineRef.current = null;
        }
      };
    }

    const latlngs = validCoords.map((coord) => leaflet.latLng(coord.lat, coord.lng));

    const addPolyline = () => {
      if (cancelled) return;

      const paneName = 'metravelRoutePane';
      let hasRoutePane = false;
      try {
        const existing = typeof map.getPane === 'function' ? map.getPane(paneName) : null;
        const pane = existing || (typeof map.createPane === 'function' ? map.createPane(paneName) : null);
        if (pane && pane.style) {
          pane.style.zIndex = '560';
          pane.style.pointerEvents = 'none';
          hasRoutePane = true;
        }
      } catch {
        // noop
      }

      const renderer = typeof leaflet.svg === 'function' && hasRoutePane ? leaflet.svg({ pane: paneName }) : undefined;

      const color = isOptimal ? primary : danger;
      const weight = isOptimal ? 5 : 4;
      const opacity = isOptimal ? 0.85 : 0.65;
      const dashArray = isOptimal ? null : '10, 10';

      const line = leaflet.polyline(latlngs, {
        color,
        weight,
        opacity,
        dashArray,
        lineJoin: 'round',
        lineCap: 'round',
        className: 'metravel-route-line',
        interactive: false,
        pane: hasRoutePane ? paneName : undefined,
        renderer,
      });

      try {
        line.addTo(map);
        if (typeof line.bringToFront === 'function') {
          line.bringToFront();
        }
        polylineRef.current = line;
      } catch {
        return;
      }

      if (!disableFitBounds) {
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

      setTimeout(() => {
        if (cancelled) return;
        try {
          map.invalidateSize?.({ animate: false, pan: false });
        } catch {
          // noop
        }
        try {
          line.redraw?.();
        } catch {
          // noop
        }
      }, 50);
    };

    if (typeof map.whenReady === 'function') {
      map.whenReady(() => {
        setTimeout(addPolyline, 0);
      });
    } else {
      setTimeout(addPolyline, 0);
    }

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // Ignore cleanup errors
        }
        polylineRef.current = null;
      }
    };
  }, [map, leafletFromProps, routeCoordinates, isOptimal, primary, danger, disableFitBounds]);

  return null;
};

export default React.memo(MapRoute);
