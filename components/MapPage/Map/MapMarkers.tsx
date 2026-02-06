import React, { useCallback, useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

interface Point {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
}

interface MapMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  Tooltip?: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>;
  popupProps?: Record<string, unknown>;
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void;
  onMarkerInstance?: (coord: string, marker: any | null) => void;
  hintCenter?: { lat: number; lng: number } | null;
}

const TOOLTIP_MAX_LEN = 30;

const MapMarkers: React.FC<MapMarkersProps> = ({
  points,
  icon,
  Marker,
  Popup,
  Tooltip,
  PopupContent,
  popupProps,
  onMarkerClick,
  onMarkerInstance,
  hintCenter,
}) => {
  const validPoints = useMemo(() => {
    return points
      .map((point, index) => {
        try {
          const ll = strToLatLng(String(point.coord), hintCenter);
          if (!ll) return null;
          // strToLatLng returns [lng, lat], so we extract them correctly
          const coords = { lat: ll[1], lng: ll[0] };
          
          // Debug: log first few points
          if (__DEV__ && index < 3) {
            console.info(`[MapMarkers] Point ${index}:`, {
              rawCoord: point.coord,
              parsedLL: ll,
              finalCoords: coords,
              llFormat: '[lng, lat]',
            });
          }
          
          if (!CoordinateConverter.isValid(coords)) return null;
          return {
            point,
            coords,
            key: point.id 
              ? `travel-${point.id}` 
              : `travel-${String(point.coord).replace(/,/g, '-')}-${index}`,
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [points, hintCenter]);

  const handleMarkerClick = useCallback(
    (e: any, point: Point, coords: { lat: number; lng: number }) => {
      // Prevent marker click from being treated as a map click (important in route mode).
      // Leaflet passes the DOM event via `originalEvent`.
      e?.originalEvent?.preventDefault?.();
      e?.originalEvent?.stopPropagation?.();

      onMarkerClick?.(point, coords);
      if (e?.target?.openPopup) {
        const map = e?.target?._map;
        let didOpen = false;
        try {
          if (map && typeof map.once === 'function') {
            map.once('moveend', () => {
              if (didOpen) return;
              didOpen = true;
              try {
                e.target.openPopup();
              } catch {
                // noop
              }
            });
          }
        } catch {
          // noop
        }

        setTimeout(() => {
          if (didOpen) return;
          didOpen = true;
          try {
            e.target.openPopup();
          } catch {
            // noop
          }
        }, 420);
      }
    },
    [onMarkerClick]
  );

  return (
    <>
      {validPoints.map(({ point, coords, key }) => (
        <Marker
          key={key}
          position={CoordinateConverter.toLeaflet(coords)}
          icon={icon}
          ref={(marker: any) => {
            try {
              if (typeof onMarkerInstance === 'function') {
                onMarkerInstance(String(point.coord ?? ''), marker ?? null);
              }
            } catch {
              // noop
            }
          }}
          eventHandlers={{
            click: (e: any) => handleMarkerClick(e, point, coords),
          }}
        >
          {Tooltip && point.address && (
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={0.95}
              className="metravel-marker-tooltip"
            >
              {point.address.length > TOOLTIP_MAX_LEN
                ? point.address.slice(0, TOOLTIP_MAX_LEN) + '…'
                : point.address}
            </Tooltip>
          )}
          <Popup {...(popupProps || {})}>
            <PopupContent point={point} />
          </Popup>
        </Marker>
      ))}
    </>
  );
};

// Memoize with custom comparison
export default React.memo(MapMarkers, (prev, next) => {
  if (prev.points.length !== next.points.length) return false;
  if (prev.icon !== next.icon) return false;
  if (prev.Marker !== next.Marker) return false;
  if (prev.Popup !== next.Popup) return false;
  if (prev.PopupContent !== next.PopupContent) return false;
  if (prev.onMarkerClick !== next.onMarkerClick) return false;

  return prev.points.every((p, i) => {
    const nextPoint = next.points[i];
    if (!nextPoint) return false;
    return (
      p.id === nextPoint.id &&
      p.coord === nextPoint.coord &&
      p.address === nextPoint.address
    );
  });
});
