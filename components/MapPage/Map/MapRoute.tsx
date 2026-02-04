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
  const layerRef = useRef<any>(null);
  const { primary, danger } = useThemedColors();

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const leaflet = leafletFromProps ?? (window as any).L;
    if (!leaflet) return;

    let cancelled = false;

    // Remove old polyline
    if (layerRef.current) {
      try {
        map.removeLayer(layerRef.current);
      } catch (_error) {
        console.warn('Error removing polyline:', _error);
      }
      layerRef.current = null;
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
        if (layerRef.current && map) {
          try {
            map.removeLayer(layerRef.current);
          } catch {
            // Ignore cleanup errors
          }
          layerRef.current = null;
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
          pane.style.zIndex = '590';
          pane.style.pointerEvents = 'none';
          hasRoutePane = true;
        }
      } catch {
        // noop
      }

      const renderer = typeof leaflet.svg === 'function' && hasRoutePane ? leaflet.svg({ pane: paneName }) : undefined;

      const mainColor = isOptimal ? primary : danger;
      const dashArray = isOptimal ? null : '10, 10';

      const outlineColor =
        typeof document !== 'undefined' &&
        document.documentElement?.getAttribute?.('data-theme') === 'dark'
          ? 'rgba(255,255,255,0.9)'
          : 'rgba(0,0,0,0.9)';

      const outline = leaflet.polyline(latlngs, {
        color: outlineColor,
        weight: isOptimal ? 10 : 9,
        opacity: 0.9,
        dashArray,
        lineJoin: 'round',
        lineCap: 'round',
        className: 'metravel-route-line metravel-route-line-outline',
        interactive: false,
        pane: hasRoutePane ? paneName : undefined,
        renderer,
      });

      const line = leaflet.polyline(latlngs, {
        color: mainColor,
        weight: isOptimal ? 6 : 5,
        opacity: 1,
        dashArray,
        lineJoin: 'round',
        lineCap: 'round',
        className: 'metravel-route-line',
        interactive: false,
        pane: hasRoutePane ? paneName : undefined,
        renderer,
      });

      const group =
        typeof leaflet.featureGroup === 'function'
          ? leaflet.featureGroup([outline, line])
          : line;

      try {
        if (group !== line) {
          group.addTo(map);
        } else {
          line.addTo(map);
        }
        if (typeof outline.bringToFront === 'function') outline.bringToFront();
        if (typeof line.bringToFront === 'function') line.bringToFront();
        layerRef.current = group;
      } catch {
        return;
      }

      if (!disableFitBounds) {
        try {
          const bounds = (group?.getBounds?.() ?? line.getBounds?.()) as any;
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
          outline.redraw?.();
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
      if (layerRef.current && map) {
        try {
          map.removeLayer(layerRef.current);
        } catch {
          // Ignore cleanup errors
        }
        layerRef.current = null;
      }
    };
  }, [map, leafletFromProps, routeCoordinates, isOptimal, primary, danger, disableFitBounds]);

  return null;
};

export default React.memo(MapRoute);
