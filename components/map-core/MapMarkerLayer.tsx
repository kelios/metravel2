// components/map-core/MapMarkerLayer.tsx
// C2.4: Shared marker layer used by both map stacks
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { strToLatLng } from '@/components/MapPage/Map/utils';
import type { LegacyMapPoint } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkerLayerProps {
  /** Points to render as markers */
  points: LegacyMapPoint[];
  /** Leaflet icon for markers */
  icon: any;
  /** React-Leaflet Marker component */
  Marker: React.ComponentType<any>;
  /** React-Leaflet Popup component */
  Popup: React.ComponentType<any>;
  /** Optional React-Leaflet Tooltip component */
  Tooltip?: React.ComponentType<any>;
  /** Content rendered inside the popup */
  PopupContent: React.ComponentType<{ point: LegacyMapPoint }>;
  /** Props passed to the Popup component (autoPan, padding, etc.) */
  popupProps?: Record<string, unknown>;
  /** Marker opacity (0–1) */
  markerOpacity?: number;
  /** Canvas renderer for performance (large datasets) */
  renderer?: any;
  /** Hint center for ambiguous lat/lng parsing */
  hintCenter?: { lat: number; lng: number } | null;
  /** Called when a marker is clicked */
  onMarkerClick?: (point: LegacyMapPoint, coords: { lat: number; lng: number }) => void;
  /** Called when a marker Leaflet instance is available */
  onMarkerInstance?: (coord: string, marker: any) => void;
}

export interface FitBoundsProps {
  /** Points to fit bounds to */
  points: LegacyMapPoint[];
  /** Leaflet L namespace */
  L: any;
  /** React-Leaflet useMap hook */
  useMap: () => any;
  /** Padding options */
  padding?: { paddingTopLeft?: [number, number]; paddingBottomRight?: [number, number] };
  /** Hint center for coordinate parsing */
  hintCenter?: { lat: number; lng: number } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLatLng = (coord: string): [number, number] | null => {
  if (!coord) return null;
  const parts = coord.split(',').map(Number);
  return parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
    ? [parts[0], parts[1]]
    : null;
};

const hasMapPane = (map: any) => !!map && !!(map as any)?._mapPane;

// ---------------------------------------------------------------------------
// MapMarkerLayer — renders markers with popups
// ---------------------------------------------------------------------------

const MapMarkerLayer: React.FC<MarkerLayerProps> = ({
  points,
  icon,
  Marker,
  Popup,
  Tooltip,
  PopupContent,
  popupProps,
  markerOpacity = 1,
  renderer,
  hintCenter,
  onMarkerClick,
  onMarkerInstance,
}) => {
  return (
    <>
      {points.map((point, index) => {
        if (!point || typeof point !== 'object') return null;

        const coords = strToLatLng(point.coord, hintCenter);
        if (!coords || !point.coord) return null;

        const markerKey =
          point.id !== undefined
            ? `marker-${point.id}`
            : `marker-${String(point.coord).replace(/[^0-9.,-]/g, '')}-${index}`;

        const position: [number, number] = [coords[1], coords[0]];

        const markerOptions: Record<string, unknown> = {
          position,
          icon,
          opacity: markerOpacity,
        };

        if (renderer && points.length > 50) {
          markerOptions.renderer = renderer;
        }

        return (
          <Marker
            key={markerKey}
            {...markerOptions}
            eventHandlers={
              onMarkerClick
                ? {
                    click: () => onMarkerClick(point, { lat: position[0], lng: position[1] }),
                  }
                : undefined
            }
            ref={
              onMarkerInstance
                ? (ref: any) => {
                    if (ref) onMarkerInstance(point.coord, ref);
                  }
                : undefined
            }
          >
            <Popup {...(popupProps ?? {})}>
              <PopupContent point={point} />
            </Popup>
            {Tooltip && point.address ? (
              <Tooltip direction="top" offset={[0, -10]}>
                {point.address}
              </Tooltip>
            ) : null}
          </Marker>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// FitBoundsOnData — fits map bounds to markers
// ---------------------------------------------------------------------------

export const FitBoundsOnData: React.FC<FitBoundsProps> = ({
  points,
  L,
  useMap,
  padding,
  hintCenter,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!hasMapPane(map)) return;

    const coords = points
      .map((p) => {
        const parsed = strToLatLng(p.coord, hintCenter);
        if (!parsed) {
          // Fallback: try simple comma split
          const simple = getLatLng(p.coord);
          return simple;
        }
        return [parsed[1], parsed[0]] as [number, number];
      })
      .filter(
        (c): c is [number, number] =>
          Array.isArray(c) &&
          c.length === 2 &&
          Number.isFinite(c[0]) &&
          Number.isFinite(c[1]),
      );

    if (!coords.length) return;

    const run = () => {
      if (!hasMapPane(map)) return;
      if (coords.length === 1) {
        try {
          map.setView(coords[0], map.getZoom(), { animate: false });
        } catch {
          // noop
        }
        return;
      }

      const bounds = L.latLngBounds(coords);
      if (!bounds.isValid()) return;

      try {
        map.fitBounds(bounds, {
          padding: [32, 32],
          animate: false,
          ...padding,
        });
      } catch {
        // noop
      }
    };

    if (typeof map.whenReady === 'function') {
      map.whenReady(run);
    } else {
      run();
    }
  }, [map, points, L, hintCenter, padding]);

  return null;
};

export default React.memo(MapMarkerLayer);

