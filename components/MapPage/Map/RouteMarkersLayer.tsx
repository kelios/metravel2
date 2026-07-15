/**
 * Route markers component - start, waypoints, end markers
 * @module components/MapPage/Map/RouteMarkersLayer
 */

import React from 'react';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { translate as i18nT } from '@/i18n'


interface RouteMarkersLayerProps {
  /**
   * React-Leaflet components
   */
  Marker: any;
  Popup: any;
  Tooltip: any;

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

  /**
   * Desktop can show hover labels; mobile route mode should stay popup-free.
   */
  showTooltips?: boolean;
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
 * - Tooltip on hover
 */
export const RouteMarkersLayer: React.FC<RouteMarkersLayerProps> = React.memo(({
  Marker,
  Tooltip,
  routePoints,
  icons,
  showTooltips = true,
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
          {showTooltips && (
            <Tooltip
              className="metravel-route-marker-tooltip"
              direction="top"
              offset={[0, -10]}
              permanent={false}
            >
              {i18nT('map:components.MapPage.Map.RouteMarkersLayer.start_9b7ad9c7')}</Tooltip>
          )}
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
             {showTooltips && (
               <Tooltip
                 className="metravel-route-marker-tooltip"
                 direction="top"
                 offset={[0, -10]}
                 permanent={false}
               >
                 {i18nT('map:components.MapPage.Map.RouteMarkersLayer.tochka_77ecea35')}{index + 2}
               </Tooltip>
             )}
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
          {showTooltips && (
            <Tooltip
              className="metravel-route-marker-tooltip"
              direction="top"
              offset={[0, -10]}
              permanent={false}
            >
              {i18nT('map:components.MapPage.Map.RouteMarkersLayer.finish_37fe48ff')}</Tooltip>
          )}
        </Marker>
      )}
    </>
  );
});

RouteMarkersLayer.displayName = 'RouteMarkersLayer';
