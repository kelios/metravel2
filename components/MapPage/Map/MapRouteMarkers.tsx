import React from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { LatLng } from '@/types/coordinates';

interface MapRouteMarkersProps {
  routePoints: LatLng[];
  startIcon: any;
  endIcon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
}

const MapRouteMarkers: React.FC<MapRouteMarkersProps> = ({
  routePoints,
  startIcon,
  endIcon,
  Marker,
  Popup,
}) => {
  if (routePoints.length === 0) return null;

  return (
    <>
      {/* Start marker */}
      {routePoints.length >= 1 && startIcon && (
        <Marker
          position={CoordinateConverter.toLeaflet(routePoints[0])}
          icon={startIcon}
          eventHandlers={{
            click: (e: any) => {
              e.originalEvent?.stopPropagation();
            },
          }}
        >
          <Popup>Старт</Popup>
        </Marker>
      )}

      {/* End marker */}
      {routePoints.length >= 2 && endIcon && (
        <Marker
          position={CoordinateConverter.toLeaflet(routePoints[routePoints.length - 1])}
          icon={endIcon}
          eventHandlers={{
            click: (e: any) => {
              e.originalEvent?.stopPropagation();
            },
          }}
        >
          <Popup>Финиш</Popup>
        </Marker>
      )}

      {/* Waypoint markers (if more than 2 points) */}
      {routePoints.length > 2 &&
        routePoints.slice(1, -1).map((point, index) => (
          <Marker
            key={`waypoint-${index}`}
            position={CoordinateConverter.toLeaflet(point)}
            eventHandlers={{
              click: (e: any) => {
                e.originalEvent?.stopPropagation();
              },
            }}
          >
            <Popup>Точка {index + 2}</Popup>
          </Marker>
        ))}
    </>
  );
};

export default React.memo(MapRouteMarkers);
