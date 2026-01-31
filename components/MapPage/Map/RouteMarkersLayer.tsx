/**
 * Route markers component - start, waypoints, end markers
 * @module components/MapPage/Map/RouteMarkersLayer
 */

import React from 'react';
import { isValidCoordinate } from '@/utils/coordinateValidator';

interface RouteMarkersLayerProps {
  /**
   * React-Leaflet components
   */
  Marker: any;
  Popup: any;

  /**
   * Route points [lng, lat][]
   */
  routePoints: [number, number][];

  /**
   * Custom icons
   */
  icons: {
    start?: any;
    end?: any;
  };
}

/**
 * Render route markers (start, waypoints, end)
 *
 * Features:
 * - Start marker (green)
 * - Waypoint markers (blue, numbered)
 * - End marker (red)
 * - Coordinate validation
 * - Click event handling
 */
export const RouteMarkersLayer: React.FC<RouteMarkersLayerProps> = React.memo(({
  Marker,
  Popup,
  routePoints,
  icons,
}) => {
  if (!routePoints || routePoints.length < 1) {
    return null;
  }

  return (
    <>
      {/* Start marker */}
      {routePoints.length >= 1 &&
       icons.start &&
       Number.isFinite(routePoints[0][0]) &&
       Number.isFinite(routePoints[0][1]) &&
       isValidCoordinate(routePoints[0][1], routePoints[0][0]) && (
        <Marker
          position={[routePoints[0][1], routePoints[0][0]]}
          icon={icons.start}
          eventHandlers={{
            click: (e: any) => {
              e?.originalEvent?.stopPropagation?.();
            },
          }}
        >
          <Popup>Старт</Popup>
        </Marker>
      )}

      {/* Waypoint markers (intermediate points) */}
      {routePoints.length > 2 &&
       routePoints.slice(1, -1).map((point, index) => {
         if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !isValidCoordinate(point[1], point[0])) {
           return null;
         }
         return (
           <Marker
             key={`waypoint-${index}`}
             position={[point[1], point[0]]}
             eventHandlers={{
               click: (e: any) => {
                 e?.originalEvent?.stopPropagation?.();
               },
             }}
           >
             <Popup>Точка {index + 2}</Popup>
           </Marker>
         );
       })}

      {/* End marker - show for any route with 2+ points */}
      {routePoints.length >= 2 &&
       icons.end &&
       (() => {
         const lastPoint = routePoints[routePoints.length - 1];
         return Number.isFinite(lastPoint[0]) &&
                Number.isFinite(lastPoint[1]) &&
                isValidCoordinate(lastPoint[1], lastPoint[0]);
       })() && (
        <Marker
          position={[routePoints[routePoints.length - 1][1], routePoints[routePoints.length - 1][0]]}
          icon={icons.end}
          eventHandlers={{
            click: (e: any) => {
              e?.originalEvent?.stopPropagation?.();
            },
          }}
        >
          <Popup>Финиш</Popup>
        </Marker>
      )}
    </>
  );
});

RouteMarkersLayer.displayName = 'RouteMarkersLayer';
