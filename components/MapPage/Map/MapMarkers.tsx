import React, { useCallback, useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

interface Point {
  id?: string | number;
  coord: string;
  address: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  articleUrl?: string;
  urlTravel?: string;
}

interface MapMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  Tooltip?: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>;
  popupProps?: Record<string, unknown>;
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void;
  onMarkerInstance?: (coord: string, marker: any | null) => void;
  hintCenter?: { lat: number; lng: number } | null;
  useMap?: () => any;
}

const PopupContentWithClose: React.FC<{
  point: Point;
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>;
  useMap?: () => any;
}> = ({ point, PopupContent, useMap: useMapHook }) => {
  const map = useMapHook?.();
  const closePopup = useCallback(() => {
    map?.closePopup();
  }, [map]);
  return <PopupContent point={point} closePopup={closePopup} />;
};

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
  useMap: useMapHook,
}) => {
  const validPoints = useMemo(() => {
    return points
      .map((point, index) => {
        try {
          const ll = strToLatLng(String(point.coord), hintCenter);
          if (!ll) return null;
          // strToLatLng returns [lng, lat], so we extract them correctly
          const coords = { lat: ll[1], lng: ll[0] };

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
      // Stop propagation on the Leaflet event to prevent map click handler (route mode).
      // IMPORTANT: Do NOT call preventDefault on originalEvent — it breaks touch-to-click on mobile.
      try {
        e?.originalEvent?.stopPropagation?.();
      } catch {
        // noop
      }

      if (e?.target?.openPopup) {
        try {
          e.target.openPopup();
        } catch {
          // noop
        }
      }

      onMarkerClick?.(point, coords);
    },
    [onMarkerClick]
  );

  return (
    <>
      {validPoints.map(({ point, coords, key }) => {
        const accessibleName = point.address || point.categoryName || 'Место на карте';
        return (
        <Marker
          key={key}
          position={CoordinateConverter.toLeaflet(coords)}
          icon={icon}
          title={accessibleName}
          alt={accessibleName}
          ref={(marker: any) => {
            try {
              if (typeof onMarkerInstance === 'function') {
                onMarkerInstance(String(point.coord ?? ''), marker ?? null);
              }
              // Add aria-label for a11y (Lighthouse aria-command-name audit)
              const el = marker?._icon || marker?.getElement?.();
              if (el && !el.getAttribute('aria-label')) {
                el.setAttribute('aria-label', accessibleName);
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
            <PopupContentWithClose point={point} PopupContent={PopupContent} useMap={useMapHook} />
          </Popup>
        </Marker>
      );
      })}
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
