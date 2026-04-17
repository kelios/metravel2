// components/MapPage/map/TravelMarkers.tsx
import React, { useCallback } from 'react';
import { strToLatLng } from './utils';
import type { Point } from './types';

interface TravelMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>;
  markerOpacity?: number;
  renderer?: any;
  hintCenter?: { lat: number; lng: number } | null;
  useMap?: () => any;
}

const TravelPopupContentWithClose: React.FC<{
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

const TravelMarkers: React.FC<TravelMarkersProps> = ({
  points,
  icon,
  Marker,
  Popup,
  PopupContent,
  markerOpacity = 1,
  renderer,
  hintCenter,
  useMap: useMapHook,
}) => {
  return (
    <>
      {points.map((point, index) => {
        if (!point || typeof point !== 'object') {
          console.warn('[Map] Invalid point data at index', index);
          return null;
        }

        const coords = strToLatLng(point.coord, hintCenter);
        if (!coords || !point.coord) {
          return null;
        }

        const markerKey = point.id !== undefined
          ? `travel-${point.id}`
          : `travel-${String(point.coord).replace(/[^0-9.,-]/g, '')}-${index}`;

        const markerOptions: any = {
          position: [coords[1], coords[0]],
          icon,
          opacity: markerOpacity,
        };

        if (renderer && points.length > 50) {
          markerOptions.renderer = renderer;
        }

        return (
          <Marker key={markerKey} {...markerOptions}>
            <Popup>
              <TravelPopupContentWithClose point={point} PopupContent={PopupContent} useMap={useMapHook} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default React.memo(TravelMarkers, (prev, next) => {
  if (prev.points.length !== next.points.length) return false;

  if (prev.icon !== next.icon || prev.Marker !== next.Marker ||
      prev.Popup !== next.Popup || prev.PopupContent !== next.PopupContent ||
      prev.renderer !== next.renderer) {
    return false;
  }

  if (prev.hintCenter?.lat !== next.hintCenter?.lat || prev.hintCenter?.lng !== next.hintCenter?.lng) {
    return false;
  }

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

