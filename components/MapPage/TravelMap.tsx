/**
 * Unified Travel Map Component
 * Reusable map component for both MapScreen and TravelDetailsPage
 * Uses all optimizations from Map.web.tsx refactoring (Phases 1-5)
 * @module components/MapPage/TravelMap
 */

import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Platform, View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { attachOsmPoiOverlay } from '@/utils/mapWebOverlays/osmPoiOverlay';
import { attachOsmCampingOverlay } from '@/utils/mapWebOverlays/osmCampingOverlay';
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { normalizePoint } from '@/components/map-core/types';

interface TravelMapProps {
  /**
   * Travel data with coordinates
   */
  travelData: any[];

  /**
   * Highlight specific point (for navigation from PointList)
   */
  highlightedPoint?: { coord: string; key: string };

  /**
   * Compact mode (smaller height, no controls)
   */
  compact?: boolean;

  /**
   * Initial zoom level
   */
  initialZoom?: number;

  /**
   * Map height (default: 400 for compact, 600 for full)
   */
  height?: number;

  /**
   * Enable clustering (recommended for >25 points)
   */
  enableClustering?: boolean;

  resizeTrigger?: number;

  /**
   * Enable overlay layers (POI, camping sites)
   * Note: Only works on full-size maps, not compact mode
   */
  enableOverlays?: boolean;

  /**
   * Draw a line connecting points (NOT routing; just straight segments).
   * Disabled by default to show only markers.
   */
  showRouteLine?: boolean;

  /**
   * Optional explicit route coordinates ([lat, lng]).
   * If provided, route line is rendered from this array instead of `travelData`.
   */
  routeLineCoords?: [number, number][];

  /**
   * Optional multiple route lines with per-track color.
   * Used by travel details when a travel has multiple uploaded track files.
   */
  routeLines?: Array<{
    coords: [number, number][];
    color?: string;
  }>;
}

/**
 * Unified map component for travel pages
 *
 * Features:
 * - Uses all optimizations from Map.web.tsx refactoring
 * - Lazy Leaflet loading (useLeafletLoader)
 * - Optimized markers (useMapMarkers)
 * - Dynamic clustering (if enabled)
 * - Modular structure (MapLayers, MapMarkers)
 * - Responsive and lightweight
 *
 * @example
 * ```typescript
 * // On travel details page:
 * <TravelMap
 *   travelData={travel.travelAddress}
 *   highlightedPoint={highlightedPoint}
 *   compact
 * />
 *
 * // On map page with clustering:
 * <TravelMap
 *   travelData={allTravels}
 *   enableClustering
 *   height={600}
 * />
 * ```
 */

/**
 * Internal component to render route line with proper Leaflet API
 * Uses custom pane and SVG renderer for correct z-index stacking
 */
interface RouteLineLayerProps {
  routeLineCoords: [number, number][];
  routeColor?: string;
  colors: ThemedColors;
  useMap: () => any;
  L: any;
}

const RouteLineLayer: React.FC<RouteLineLayerProps> = ({ routeLineCoords, routeColor, colors, useMap, L }) => {
  const map = useMap();
  const polylineRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map || !L || routeLineCoords.length < 2) {
      // Remove old polyline if exists
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // noop
        }
        polylineRef.current = null;
      }
      return;
    }

    // Remove old polyline
    if (polylineRef.current) {
      try {
        map.removeLayer(polylineRef.current);
      } catch {
        // noop
      }
      polylineRef.current = null;
    }

    // Ensure custom pane exists with proper z-index
    const paneName = 'metravelRoutePane';
    let pane: HTMLElement | null = null;
    try {
      pane = typeof map.getPane === 'function' ? map.getPane(paneName) : null;
      if (!pane && typeof map.createPane === 'function') {
        pane = map.createPane(paneName);
      }
      if (pane && pane.style) {
        pane.style.zIndex = '450';
        pane.style.pointerEvents = 'none';
      }
    } catch {
      // noop
    }

    // Convert coords to Leaflet LatLng
    const latlngs = routeLineCoords
      .filter(([lat, lng]) =>
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
      )
      .map(([lat, lng]) => L.latLng(lat, lng));

    if (latlngs.length < 2) return;

    // Add polyline with slight delay to ensure pane is ready
    const addPolyline = () => {
      if (!mountedRef.current) return;

      // Create SVG renderer for custom pane
      const hasRoutePane = !!pane;
      const renderer = typeof L.svg === 'function'
        ? L.svg(hasRoutePane ? { pane: paneName } : undefined)
        : undefined;

      // Draw route in two passes: contrast halo + main line.
      // This keeps track visible on any OSM background.
      const halo = L.polyline(latlngs, {
        color: colors.surface || DESIGN_TOKENS.colors.surface,
        weight: 8,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
        renderer,
        pane: hasRoutePane ? paneName : 'overlayPane',
        className: 'metravel-route-line-halo',
      });

      const line = L.polyline(latlngs, {
        color: routeColor || colors.info || colors.primary || DESIGN_TOKENS.colors.primary,
        weight: 5,
        opacity: 1,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
        renderer,
        pane: hasRoutePane ? paneName : 'overlayPane',
        className: 'metravel-route-line',
      });

      try {
        const routeLayer = L.layerGroup([halo, line]);
        routeLayer.addTo(map);
        
        // Force polyline to front
        if (typeof line.bringToFront === 'function') {
          line.bringToFront();
        }
        
        polylineRef.current = routeLayer;
      } catch (error) {
        console.error('[TravelMap] RouteLineLayer: failed to add polyline', error);
        try {
          line.remove?.();
        } catch {
          // noop
        }
      }
    };

    // Small delay to ensure pane is in DOM
    const timer = setTimeout(addPolyline, 10);

    return () => {
      clearTimeout(timer);
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // noop
        }
        polylineRef.current = null;
      }
    };
  }, [map, L, routeLineCoords, routeColor, colors.info, colors.primary, colors.surface]);

  return null;
};
export const TravelMap: React.FC<TravelMapProps> = ({
  travelData = [],
  highlightedPoint,
  compact = false,
  initialZoom = 11,
  height,
  enableClustering = false,
  resizeTrigger,
  enableOverlays = false,
  showRouteLine = false,
  routeLineCoords: routeLineCoordsProp,
  routeLines: routeLinesProp,
}) => {
  const queryClient = useQueryClient();
  const colors = useThemedColors();
  const themeContextValue = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  // `travelData` comes from API and can be null/invalid for some items.
  // Coerce to an array to avoid runtime crashes inside hooks/components that iterate it.
  const safeTravelData = useMemo<any[]>(
    () => (Array.isArray(travelData) ? travelData.map((item, i) => normalizePoint(item, i)) : []),
    [travelData]
  );
  const mapRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const markerByCoordRef = useRef<Map<string, any>>(new Map());
  const mountedRef = useRef(true);
  const [mapReady, setMapReady] = useState(false);
  const overlayControllersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Do NOT call map.remove() — react-leaflet's MapContainer handles its own
      // cleanup via its unmount effect, and our leafletFix.ts patch makes that safe.
      mapRef.current = null;
    };
  }, []);

  // Lazy load Leaflet
  const { L, RL: rl, loading: leafletLoading, ready: leafletReady } = useLeafletLoader({
    enabled: Platform.OS === 'web',
    useIdleCallback: true,
  });

  // Custom icons
  const customIcons = useLeafletIcons(L);

  // Calculate center from travel data
  const center = useMemo(() => {
    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      const firstCoord = routeLinesProp[0]?.coords?.[0];
      if (
        Array.isArray(firstCoord) &&
        Number.isFinite(firstCoord[0]) &&
        Number.isFinite(firstCoord[1])
      ) {
        return [firstCoord[0], firstCoord[1]];
      }
    }

    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length > 0) {
      const [lat, lng] = routeLineCoordsProp[0];
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
    }

    if (safeTravelData.length === 0) {
      return [53.9006, 27.559]; // Default: Minsk
    }

    // Take first point as center
    const firstPoint = safeTravelData[0];
    const coordStr = String(firstPoint?.coord || '').trim();

    if (!coordStr) return [53.9006, 27.559];

    try {
      const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
      const parts = cleaned.split(',');

      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lat, lng];
        }
      }
    } catch {
      // Fallback
    }

    return [53.9006, 27.559];
  }, [safeTravelData, routeLineCoordsProp, routeLinesProp]);

  // Use optimized markers hook
  const {
    shouldRenderClusters,
    clusters,
    markers,
    markerOpacity,
  } = useMapMarkers({
    travelData: safeTravelData,
    mapZoom: initialZoom,
    expandedClusterKey: null,
    mode: 'radius',
    hintCenter: { lat: center[0], lng: center[1] },
  });

  // Popup component
  const PopupComponent = useMemo(() => {
    if (!rl) return null;
    return createMapPopupComponent({
      colors,
      themeContextValue,
      userLocation: null,
      compactLayout: compact,
      fullscreenOnMobile: true,
      invalidateUserPoints: () => {
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      },
    });
  }, [colors, compact, queryClient, rl, themeContextValue]);

  const handlePopupOpen = useCallback((e: any) => {
    const popup = e?.popup;
    const popupEl: HTMLElement | null = popup?.getElement ? popup.getElement() : null;
    const map = mapRef.current;
    const mapEl: HTMLElement | null = map?.getContainer ? map.getContainer() : null;
    if (!popupEl || !mapEl || typeof window === 'undefined') return;

    const run = () => {
      try {
        const mapRect = mapEl.getBoundingClientRect();
        const popupRectAbs = popupEl.getBoundingClientRect();
        const popupRect = {
          left: popupRectAbs.left - mapRect.left,
          top: popupRectAbs.top - mapRect.top,
          right: popupRectAbs.right - mapRect.left,
          bottom: popupRectAbs.bottom - mapRect.top,
          width: popupRectAbs.width,
          height: popupRectAbs.height,
        };

        const isNarrowMap = mapRect.width <= 640;
        const horizontalPadding = mapRect.width <= 420 ? 12 : isNarrowMap ? 16 : 24;
        const verticalPadding = isNarrowMap ? 18 : 24;
        let dx = 0;
        let dy = 0;

        const popupCenterX = popupRect.left + popupRect.width / 2;
        const popupCenterY = popupRect.top + popupRect.height / 2;
        const safeLeft = horizontalPadding;
        const safeRight = mapRect.width - horizontalPadding;
        const safeTop = verticalPadding;
        const safeBottom = mapRect.height - verticalPadding;
        const safeCenterX = (safeLeft + safeRight) / 2;
        const safeCenterY = (safeTop + safeBottom) / 2;
        const overflowLeft = horizontalPadding - popupRect.left;
        const overflowRight = popupRect.right - (mapRect.width - horizontalPadding);
        const overflowTop = verticalPadding - popupRect.top;
        const overflowBottom = popupRect.bottom - safeBottom;

        if (overflowLeft > 0 && overflowRight > 0) {
          dx = popupCenterX - safeCenterX;
        } else if (overflowLeft > 0) {
          dx = -overflowLeft;
        } else if (overflowRight > 0) {
          dx = overflowRight;
        } else if (isNarrowMap) {
          const centerDeltaX = popupCenterX - safeCenterX;
          if (Math.abs(centerDeltaX) > 18) {
            dx = centerDeltaX;
          }
        }

        if (overflowTop > 0 && overflowBottom > 0) {
          dy = popupCenterY - safeCenterY;
        } else if (overflowTop > 0) {
          dy = -overflowTop;
        } else if (overflowBottom > 0) {
          dy = overflowBottom;
        } else if (isNarrowMap) {
          const centerDeltaY = popupCenterY - safeCenterY;
          if (Math.abs(centerDeltaY) > 24) {
            dy = centerDeltaY;
          }
        }

        if (Math.abs(dx) < 6) dx = 0;
        if (Math.abs(dy) < 6) dy = 0;
        if (!dx && !dy) return;

        map?.panBy?.([dx, dy], { animate: true, duration: 0.35 } as any);
      } catch {
        // noop
      }
    };

    let rafId = 0;
    const scheduleRun = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(run);
      });
    };

    scheduleRun();

    let resizeObserver: ResizeObserver | null = null;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      map?.off?.('popupclose', cleanup);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleRun();
      });
      resizeObserver.observe(popupEl);
      const popupContentEl = popupEl.querySelector('.leaflet-popup-content');
      if (popupContentEl instanceof HTMLElement) {
        resizeObserver.observe(popupContentEl);
      }
    }

    map?.on?.('popupclose', cleanup);
    cleanupTimer = setTimeout(cleanup, 1000);
  }, []);

  const popupProps = useMemo(() => {
    const isNarrowViewport = viewportWidth <= 768;
    const isVeryNarrow = viewportWidth <= 480;
    const maxWidth = compact
      ? isVeryNarrow
        ? Math.min(236, Math.max(208, viewportWidth - 20))
        : isNarrowViewport
          ? Math.min(284, Math.max(236, viewportWidth - 28))
          : Math.min(300, Math.max(248, viewportWidth - 32))
      : isVeryNarrow
        ? Math.min(284, Math.max(240, viewportWidth - 28))
        : isNarrowViewport
          ? Math.min(320, Math.max(264, viewportWidth - 32))
          : Math.min(388, Math.max(300, viewportWidth - 40));
    const minWidth = compact
      ? isVeryNarrow
        ? Math.min(212, Math.max(188, maxWidth - 20))
        : isNarrowViewport
          ? Math.min(236, Math.max(208, maxWidth - 32))
          : Math.min(248, Math.max(220, maxWidth - 44))
      : isVeryNarrow
        ? 220
        : isNarrowViewport
          ? Math.min(260, Math.max(228, maxWidth - 44))
          : Math.min(308, Math.max(256, maxWidth - 72));

    return {
      autoPan: true,
      keepInView: true,
      className: 'metravel-place-popup',
      maxWidth,
      minWidth,
      autoPanPaddingTopLeft: compact
        ? (isVeryNarrow ? [8, 56] : [12, 72])
        : isNarrowViewport
          ? [12, 72]
          : [24, 140],
      autoPanPaddingBottomRight: compact
        ? (isVeryNarrow ? [8, 104] : [12, 72])
        : isNarrowViewport
          ? [12, 72]
          : [24, 140],
      eventHandlers: {
        popupopen: handlePopupOpen,
      },
    };
  }, [compact, handlePopupOpen, viewportWidth]);

  // Convert travel data to route line coordinates
  const routeLineCoords = useMemo(() => {
    if (!showRouteLine) return [];
    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length >= 2) {
      return routeLineCoordsProp.filter(
        ([lat, lng]) =>
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
      );
    }
    if (safeTravelData.length < 2) return [];

    const coords: [number, number][] = [];
    for (const point of safeTravelData) {
      const coordStr = String(point?.coord || '').trim();
      if (!coordStr) continue;

      try {
        const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
        const parts = cleaned.split(',');

        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            coords.push([lat, lng]);
          }
        }
      } catch {
        // Skip invalid coordinates
      }
    }

    return coords;
  }, [showRouteLine, routeLineCoordsProp, safeTravelData]);

  const normalizedRouteLines = useMemo(() => {
    if (!showRouteLine) return [] as Array<{ coords: [number, number][]; color?: string }>;

    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      return routeLinesProp
        .map((line) => ({
          color: line?.color,
          coords: (Array.isArray(line?.coords) ? line.coords : []).filter(
            ([lat, lng]) =>
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
          ),
        }))
        .filter((line) => line.coords.length >= 2);
    }

    if (routeLineCoords.length >= 2) {
      return [{ coords: routeLineCoords }];
    }

    return [] as Array<{ coords: [number, number][]; color?: string }>;
  }, [showRouteLine, routeLineCoords, routeLinesProp]);

  const hasRenderableMapData = safeTravelData.length > 0 || normalizedRouteLines.length > 0;

  // Highlight point when requested
  useEffect(() => {
    if (!highlightedPoint || !mapRef.current) return;

    try {
      const { coord } = highlightedPoint;
      const marker = markerByCoordRef.current.get(coord);

      if (marker && typeof marker.openPopup === 'function') {
        // Center on marker
        const map = mapRef.current;
        if (typeof map.setView === 'function') {
          const latlng = marker.getLatLng();
          map.setView(latlng, 14, { animate: true });
        }

        // Open popup
        setTimeout(() => {
          marker.openPopup();
        }, 300);
      }
    } catch (err) {
      console.warn('[TravelMap] Failed to highlight point:', err);
    }
  }, [highlightedPoint]);

  // Invalidate size when map opens or resizes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mapRef.current) return;
    if (resizeTrigger === undefined) return;

    const map = mapRef.current;
    const invalidate = () => {
      try {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: true, pan: false });
        }
      } catch {
        // noop
      }
    };

    // Two-pass invalidation: immediate (rAF) + delayed for CSS transitions
    const rafId = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame(invalidate)
      : undefined;
    const timer = setTimeout(invalidate, 300);

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [resizeTrigger]);

  // Also invalidate when map becomes ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const invalidate = () => {
      try {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: false, pan: false });
        }
      } catch {
        // noop
      }
    };

    // Two-pass: immediate + delayed for layout settle
    invalidate();
    const timer = setTimeout(invalidate, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [mapReady]);

  // Fit bounds to show ALL travel points when map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !L) return;

    const map = mapRef.current;

    const points: [number, number][] = [];

    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      for (const routeLine of routeLinesProp) {
        const coords = Array.isArray(routeLine?.coords) ? routeLine.coords : [];
        points.push(
          ...coords.filter(
            ([lat, lng]) =>
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
          )
        );
      }
    }

    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length > 0) {
      points.push(
        ...routeLineCoordsProp.filter(
          ([lat, lng]) =>
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        )
      );
    }

    for (const point of safeTravelData) {
      const coordStr = String(point?.coord || '').trim();
      if (!coordStr) continue;

      try {
        const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
        const parts = cleaned.split(',');

        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);

          if (
            Number.isFinite(lat) && Number.isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
          ) {
            points.push([lat, lng]);
          }
        }
      } catch {
        // Skip invalid coordinates
      }
    }

    if (points.length === 0) return;

    // Use fitBounds to show all points
    const fitMap = () => {
      try {
        if (!map || typeof map.fitBounds !== 'function') return;
        const leafletPoints = points.map(([lat, lng]) => L.latLng(lat, lng));
        const bounds = L.latLngBounds(leafletPoints);
        map.fitBounds(bounds.pad(0.15), { animate: false, maxZoom: 15 });
      } catch {
        // noop
      }
    };

    // Delay slightly to ensure map container is fully laid out
    const timer = setTimeout(fitMap, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [mapReady, L, safeTravelData, routeLineCoordsProp, routeLinesProp]);

  // Initialize overlay layers when map is ready and overlays are enabled
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mapReady || !mapRef.current || !L) return;
    if (!enableOverlays || compact) return; // Don't add overlays in compact mode

    const map = mapRef.current;

    const controllersSnapshot = overlayControllersRef.current;

    // Cleanup existing overlays
    controllersSnapshot.forEach((controller) => {
      try {
        if (controller.stop) controller.stop();
        if (controller.layer && map) {
          map.removeLayer(controller.layer);
        }
      } catch {
        // noop
      }
    });
    controllersSnapshot.clear();

    try {
      // Initialize POI overlay (достопримечательности)
      const poiController = attachOsmPoiOverlay(L, map, {
        maxAreaKm2: 2500,
        debounceMs: 700,
        categories: ['Достопримечательности', 'Видовые места', 'Культура'],
      });

      if (poiController && poiController.layer) {
        poiController.layer.addTo(map);
        controllersSnapshot.set('osm-poi', poiController);
        poiController.start();
      }
    } catch {
      // noop
    }

    try {
      // Initialize camping overlay (кемпинги/заночуй в лесе)
      const campingController = attachOsmCampingOverlay(L, map, {
        maxAreaKm2: 2500,
        debounceMs: 700,
      });

      if (campingController && campingController.layer) {
        campingController.layer.addTo(map);
        controllersSnapshot.set('osm-camping', campingController);
        campingController.start();
      }
    } catch {
      // noop
    }

    return () => {
      // Cleanup overlays when unmounting or dependencies change
      controllersSnapshot.forEach((controller) => {
        try {
          if (controller.stop) controller.stop();
          if (controller.layer && map) {
            map.removeLayer(controller.layer);
          }
        } catch {
          // noop
        }
      });
      controllersSnapshot.clear();
    };
  }, [mapReady, L, enableOverlays, compact]);

  // Map styles
  const mapHeight = height || (compact ? 400 : 600);
  const mapBorderRadius = compact ? 12 : 16;
  const mapContainerStyle = useMemo(
    () => ({ height: mapHeight, borderRadius: mapBorderRadius }),
    [mapBorderRadius, mapHeight]
  );

  // Loading state
  if (!leafletReady || leafletLoading) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No data state
  if (!hasRenderableMapData) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.emptyContainer]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  // Render map
  if (!L || !rl) return null;

  const { MapContainer, TileLayer } = rl;

  if (!MapContainer || !TileLayer) return null;

  const shouldCluster = enableClustering && shouldRenderClusters;

  return (
    <View
      ref={containerRef}
      style={[styles.mapContainer, mapContainerStyle]}
      testID="travel-map"
      {...(Platform.OS === 'web' ? { 'data-testid': 'travel-map' } : {})}
    >
      <MapContainer
        center={center as [number, number]}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%', minHeight: mapHeight }}
        zoomControl={true}
        scrollWheelZoom={true}
        dragging={true}
        ref={(map: any) => {
          if (!mountedRef.current) return;
          if (map && !mapRef.current) {
            mapRef.current = map;
          }
        }}
        whenReady={() => {
          if (!mountedRef.current) return;
          setMapReady(true);
        }}
      >
        {/* Base tile layer — crossOrigin нужен для захвата карты через html2canvas при экспорте в PDF */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          crossOrigin="anonymous"
        />

        {/* Route line connecting travel points - using custom layer for proper z-index */}
        {showRouteLine && rl.useMap && normalizedRouteLines.map((routeLine, index) => (
          <RouteLineLayer
            key={`route-line-${index}-${routeLine.coords.length}`}
            routeLineCoords={routeLine.coords}
            routeColor={routeLine.color}
            colors={colors}
            useMap={rl.useMap}
            L={L}
          />
        ))}

        {/* Travel markers (not clustered) */}
        {customIcons?.meTravel && markers.length > 0 && !shouldCluster && PopupComponent && (
          <MapMarkers
            points={markers}
            icon={customIcons.meTravel}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            onMarkerClick={() => {}}
            hintCenter={{ lat: center[0], lng: center[1] }}
            onMarkerInstance={(coord, marker) => {
              try {
                const key = String(coord ?? '').trim();
                if (!key) return;
                markerByCoordRef.current.set(key, marker);
              } catch {
                // noop
              }
            }}
          />
        )}

        {/* Travel markers (clustered) */}
        {customIcons?.meTravel && markers.length > 0 && shouldCluster && PopupComponent && (
          <ClusterLayer
            L={L}
            clusters={clusters as any}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            markerIcon={customIcons.meTravel}
            markerOpacity={markerOpacity}
            expandedClusterKey={null}
            expandedClusterItems={null as any}
            hintCenter={{ lat: center[0], lng: center[1] }}
            onClusterZoom={() => {}}
            onMarkerClick={() => {}}
            onMarkerInstance={(coord, marker) => {
              try {
                const key = String(coord ?? '').trim();
                if (!key) return;
                markerByCoordRef.current.set(key, marker);
              } catch {
                // noop
              }
            }}
          />
        )}
      </MapContainer>

    </View>
  );
};

// Заметка: в текущей TS-конфигурации проекта тип StyleSheet может не экспонировать create,
// поэтому используем plain object для стилей (RNW это поддерживает).
const styles: any = {
  mapContainer: {
    width: '100%',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
    position: 'relative',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
};
