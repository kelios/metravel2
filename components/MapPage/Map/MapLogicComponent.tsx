// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '@/types/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

interface Point {
  id?: number;
  coord: string;
  address: string;
}

type MapMode = 'radius' | 'route';

interface MapLogicProps {
  mapClickHandler: (e: any) => void;
  mode: MapMode;
  coordinates: LatLng;
  userLocation: LatLng | null;
  disableFitBounds: boolean;
  L: any;
  travelData: Point[];
  circleCenter?: LatLng | null;
  radiusInMeters?: number | null;
  fitBoundsPadding?: { paddingTopLeft?: [number, number]; paddingBottomRight?: [number, number] } | null;
  setMapZoom: (z: number) => void;
  mapRef: React.MutableRefObject<any>;
  onMapReady: (map: any) => void;
  savedMapViewRef: React.MutableRefObject<any>;
  hasInitializedRef: React.MutableRefObject<boolean>;
  lastModeRef: React.MutableRefObject<MapMode | null>;
  lastAutoFitKeyRef: React.MutableRefObject<string | null>;
  leafletBaseLayerRef: React.MutableRefObject<any>;
  leafletOverlayLayersRef: React.MutableRefObject<Map<string, any>>;
  leafletControlRef: React.MutableRefObject<any>;
  useMap: () => any;
  useMapEvents: (handlers: any) => any;
  hintCenter?: LatLng | null;
}

export const MapLogicComponent: React.FC<MapLogicProps> = ({
  mapClickHandler,
  mode,
  coordinates,
  userLocation,
  disableFitBounds,
  L,
  travelData,
  circleCenter,
  radiusInMeters,
  fitBoundsPadding,
  setMapZoom,
  mapRef,
  onMapReady,
  savedMapViewRef,
  hasInitializedRef,
  lastModeRef,
  lastAutoFitKeyRef,
  leafletBaseLayerRef: _leafletBaseLayerRef,
  leafletOverlayLayersRef: _leafletOverlayLayersRef,
  leafletControlRef: _leafletControlRef,
  useMap,
  useMapEvents,
  hintCenter,
}) => {
  const map = useMap();
  const hasCalledOnMapReadyRef = useRef(false);
  const lastUserLocationKeyRef = useRef<string | null>(null);
  const lastRadiusKeyRef = useRef<string | null>(null);

  const debugEnabled = useMemo(() => {
    try {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
      if (typeof window === 'undefined') return false;
      const sp = new URLSearchParams(window.location.search);
      const fromQuery = sp.has('mapDebug') && String(sp.get('mapDebug') ?? '1') !== '0';
      let fromStorage = false;
      try {
        fromStorage = window.localStorage?.getItem('metravel.mapDebug') === '1';
      } catch {
        fromStorage = false;
      }
      if (fromQuery) {
        try {
          window.localStorage?.setItem('metravel.mapDebug', '1');
        } catch {
          // noop
        }
      }
      return fromQuery || fromStorage;
    } catch {
      return false;
    }
  }, []);

  const [debugOpen, setDebugOpen] = useState(true);
  const [debugSnapshot, setDebugSnapshot] = useState<any>(null);
  const lastDebugSnapshotTsRef = useRef(0);

  const refreshDebugSnapshot = useCallback(
    (reason?: string) => {
      try {
        if (!debugEnabled) return;
        if (typeof window === 'undefined') return;
        const now = Date.now();
        if (now - lastDebugSnapshotTsRef.current < 250) return;
        lastDebugSnapshotTsRef.current = now;

        const dbg = (window as any).__metravelMapDebug;
        const payload = typeof dbg?.dump === 'function' ? dbg.dump() : null;
        setDebugSnapshot({
          ts: now,
          reason: reason || null,
          payload,
        });
      } catch {
        // noop
      }
    },
    [debugEnabled]
  );

  const copyDebugJson = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      const dbg = (window as any).__metravelMapDebug;
      const text =
        typeof dbg?.dumpJson === 'function'
          ? String(dbg.dumpJson())
          : JSON.stringify(debugSnapshot ?? null, null, 2);

      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(text);
        return;
      }

      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // noop
      }
    } catch {
      // noop
    }
  }, [debugSnapshot]);

  const hasRadiusResults = (travelData ?? []).length > 0;
  const canAutoFitRadiusView =
    hasRadiusResults ||
    (isTestEnv && circleCenter && Number.isFinite(radiusInMeters) && Number(radiusInMeters) > 0);

  // Helper: ensure mapZoom state matches real leaflet zoom even after programmatic moves.
  const syncZoomFromMap = useCallback(() => {
    try {
      if (!map) return;
      const z = map.getZoom?.();
      if (Number.isFinite(z)) setMapZoom(z);
    } catch {
      // noop
    }
  }, [map, setMapZoom]);

  // Handle map events
  useMapEvents({
    click: mapClickHandler,
    zoomend: () => {
      syncZoomFromMap();
      refreshDebugSnapshot('zoomend');
    },
    moveend: () => {
      // fitBounds can sometimes update zoom while zoomend isn't our first reliable signal
      syncZoomFromMap();
      refreshDebugSnapshot('moveend');
    },
    zoomstart: () => {
      try {
        if (map) {
          map.closePopup();
        }
      } catch {
        // noop
      }
    },
  });

  // Keep map ref and call onMapReady
  useEffect(() => {
    mapRef.current = map;
    if (!map) return;

    let cancelled = false;
    const markReady = () => {
      if (cancelled || hasCalledOnMapReadyRef.current) return;
      hasCalledOnMapReadyRef.current = true;

      try {
        const ac = (map as any).attributionControl;
        if (ac && typeof ac.setPrefix === 'function') {
          const prefix = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>';
          ac.setPrefix(prefix);
        }
      } catch {
        // noop
      }

      // Ensure route polyline pane is always above tiles.
      // In some web exports/e2e builds pane stacking can be broken, causing the route line to render under tiles.
      try {
        const paneName = 'metravelRoutePane';
        const existing = typeof (map as any).getPane === 'function' ? (map as any).getPane(paneName) : null;
        const pane = existing || (typeof (map as any).createPane === 'function' ? (map as any).createPane(paneName) : null);
        if (pane && pane.style) {
          pane.style.zIndex = '560';
          pane.style.pointerEvents = 'none';
        }
      } catch {
        // noop
      }

      try {
        if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof window !== 'undefined') {
          const dumpRoute = () => {
            try {
              if (typeof document === 'undefined') return { ok: false, reason: 'no-document' };
              const el = document.querySelector('path.metravel-route-line') as SVGPathElement | null;
              const overlayPane = document.querySelector('.leaflet-overlay-pane') as HTMLElement | null;
              const overlaySvg = overlayPane?.querySelector('svg') as SVGSVGElement | null;

              if (!el) {
                return {
                  ok: false,
                  reason: 'no-path',
                  overlayPaneExists: !!overlayPane,
                  overlaySvgExists: !!overlaySvg,
                  overlayPathCount: overlayPane?.querySelectorAll('path')?.length ?? null,
                };
              }

              const rect = el.getBoundingClientRect();
              let bbox: any = null;
              let totalLength: number | null = null;

              try {
                bbox = typeof el.getBBox === 'function' ? el.getBBox() : null;
              } catch {
                bbox = null;
              }

              try {
                totalLength = typeof el.getTotalLength === 'function' ? Number(el.getTotalLength()) : null;
              } catch {
                totalLength = null;
              }

              let computed: any = null;
              try {
                const s = window.getComputedStyle(el);
                computed = {
                  stroke: s.stroke,
                  strokeWidth: s.strokeWidth,
                  strokeOpacity: (s as any).strokeOpacity,
                  opacity: s.opacity,
                  display: s.display,
                  visibility: s.visibility,
                  pointerEvents: (s as any).pointerEvents,
                };
              } catch {
                computed = null;
              }

              return {
                ok: true,
                attrs: {
                  class: el.getAttribute('class'),
                  dLength: el.getAttribute('d')?.length ?? null,
                  stroke: el.getAttribute('stroke'),
                  strokeWidth: el.getAttribute('stroke-width'),
                  strokeOpacity: el.getAttribute('stroke-opacity'),
                  opacity: el.getAttribute('opacity'),
                },
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                bbox,
                totalLength,
                computed,
                overlay: {
                  overlayPaneExists: !!overlayPane,
                  overlaySvgExists: !!overlaySvg,
                  overlayPathCount: overlayPane?.querySelectorAll('path')?.length ?? null,
                },
              };
            } catch (e: any) {
              return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
            }
          };

          const dumpOverlays = () => {
            try {
              const out: any[] = [];
              const overlaysRef = _leafletOverlayLayersRef?.current;
              const entries = overlaysRef && typeof overlaysRef.entries === 'function' ? Array.from(overlaysRef.entries()) : [];

              for (const [id, layer] of entries) {
                let hasLayer: boolean | null = null;
                try {
                  hasLayer = typeof map.hasLayer === 'function' ? Boolean(map.hasLayer(layer)) : null;
                } catch {
                  hasLayer = null;
                }

                let tileStats: any = null;
                try {
                  const container = layer?.getContainer?.() as HTMLElement | undefined;
                  if (container && typeof container.querySelectorAll === 'function') {
                    const imgs = container.querySelectorAll('img.leaflet-tile');
                    const loaded = container.querySelectorAll('img.leaflet-tile-loaded');
                    tileStats = {
                      imgCount: imgs.length,
                      loadedCount: loaded.length,
                      containerZIndex: typeof window.getComputedStyle === 'function' ? window.getComputedStyle(container).zIndex : null,
                      containerOpacity: typeof window.getComputedStyle === 'function'
                        ? window.getComputedStyle(container).opacity
                        : null,
                    };
                  }
                } catch {
                  tileStats = null;
                }

                out.push({
                  id,
                  hasLayer,
                  kindHints: {
                    isTileLayer: Boolean(layer?.getTileUrl || layer?._url || layer?.getContainer),
                    url: layer?._url ?? null,
                    zIndexOption: layer?.options?.zIndex ?? null,
                    opacityOption: layer?.options?.opacity ?? null,
                  },
                  tileStats,
                });
              }

              return { ok: true, count: out.length, overlays: out };
            } catch (e: any) {
              return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
            }
          };

          const dumpMap = () => {
            try {
              const center = map.getCenter?.();
              const zoom = map.getZoom?.();
              const size = map.getSize?.();

              const paneNames = [
                'mapPane',
                'tilePane',
                'overlayPane',
                'shadowPane',
                'markerPane',
                'tooltipPane',
                'popupPane',
                'metravelRoutePane',
              ];
              const panes: Record<string, any> = {};

              for (const name of paneNames) {
                try {
                  const p = map.getPane?.(name) as HTMLElement | null | undefined;
                  if (!p) {
                    panes[name] = null;
                    continue;
                  }
                  const cs = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(p) : null;
                  panes[name] = {
                    exists: true,
                    styleZIndex: (p as any).style?.zIndex ?? null,
                    computedZIndex: cs ? cs.zIndex : null,
                    pointerEvents: cs ? (cs as any).pointerEvents : null,
                    display: cs ? cs.display : null,
                    visibility: cs ? cs.visibility : null,
                  };
                } catch {
                  panes[name] = { exists: false, error: true };
                }
              }

              return {
                ok: true,
                center: center ? { lat: center.lat, lng: center.lng } : null,
                zoom: Number.isFinite(zoom) ? zoom : null,
                size: size ? { x: size.x, y: size.y } : null,
                panes,
              };
            } catch (e: any) {
              return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
            }
          };

          (window as any).__metravelMapDebug = {
            dumpRoute,
            dumpOverlays,
            dumpMap,
            dump: () => ({ map: dumpMap(), route: dumpRoute(), overlays: dumpOverlays() }),
            dumpJson: () => {
              try {
                const payload = { map: dumpMap(), route: dumpRoute(), overlays: dumpOverlays() };
                const seen = new WeakSet<object>();
                return JSON.stringify(
                  payload,
                  (_k, v) => {
                    try {
                      if (v && typeof v === 'object') {
                        if (seen.has(v as object)) return '[Circular]';
                        seen.add(v as object);
                      }
                      if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) {
                        const el = v as HTMLElement;
                        return `[HTMLElement ${el.tagName}${el.id ? `#${el.id}` : ''}${el.className ? `.${String(el.className).toString().split(' ').join('.')}` : ''}]`;
                      }
                      if (typeof SVGElement !== 'undefined' && v instanceof SVGElement) {
                        const el = v as SVGElement;
                        return `[SVGElement ${el.tagName}${(el as any).id ? `#${String((el as any).id)}` : ''}]`;
                      }
                      if (typeof v === 'function') return '[Function]';
                      return v;
                    } catch {
                      return '[Unserializable]';
                    }
                  },
                  2
                );
              } catch (e: any) {
                return JSON.stringify({ ok: false, reason: 'stringify-failed', message: String(e?.message ?? e) });
              }
            },
            copyDump: async () => {
              try {
                const text = (window as any).__metravelMapDebug?.dumpJson?.();
                if (!text) return { ok: false, reason: 'no-text' };
                if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
                  await (navigator as any).clipboard.writeText(text);
                  return { ok: true, copied: true, length: String(text).length };
                }
                return { ok: true, copied: false, length: String(text).length, text };
              } catch (e: any) {
                return { ok: false, reason: 'copy-failed', message: String(e?.message ?? e) };
              }
            },
          };
        }
      } catch {
        // noop
      }

      try {
        refreshDebugSnapshot('map-ready');
      } catch {
        // noop
      }

      onMapReady(map);
    };

    try {
      if (typeof map.whenReady === 'function') {
        map.whenReady(markReady);
      } else {
        markReady();
      }
    } catch {
      // noop
    }

    try {
      setMapZoom(map.getZoom());
    } catch {
      // noop
    }

    try {
      // map.whenReady may fire before first layout; we still sync zoom right after.
      syncZoomFromMap();
    } catch {
      // noop
    }

    return () => {
      cancelled = true;
      hasCalledOnMapReadyRef.current = false;
    };
  }, [map, mapRef, onMapReady, refreshDebugSnapshot, setMapZoom, syncZoomFromMap, _leafletOverlayLayersRef]);

  // Close popup on map click or zoom
  useEffect(() => {
    if (!map) return;
    const close = () => {
      try {
        map.closePopup();
      } catch {
        // noop
      }
    };
    map.on('click', close);
    map.on('zoomstart', close);
    return () => {
      map.off('click', close);
      map.off('zoomstart', close);
    };
  }, [map]);

  // Save current map view (route mode only)
  useEffect(() => {
    if (!map || mode !== 'route') return;

    const saveView = () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        savedMapViewRef.current = {
          center: [center.lat, center.lng],
          zoom,
        };
      } catch {
        // noop
      }
    };

    map.on('moveend', saveView);
    map.on('zoomend', saveView);

    return () => {
      map.off('moveend', saveView);
      map.off('zoomend', saveView);
    };
  }, [map, mode, savedMapViewRef]);

  // Route mode + initial setView + radius initial setView
  useEffect(() => {
    if (!map) return;

    // Safe coordinate check
    const hasValidCoords = Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng);
    const hasValidUserLocation = userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng);

    if (mode === 'route') {
      if (!hasInitializedRef.current && hasValidCoords) {
        map.setView([coordinates.lat, coordinates.lng], 13, { animate: false });
        // ensure clusters get correct zoom after programmatic set
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      }
      lastModeRef.current = mode;
      return;
    }

    // Radius mode: as soon as userLocation is available, center the map on it.
    // Do this BEFORE results are ready so the initial UX is "centered on me".
    // Keep tests unchanged (tests expect setView only after radius results).
    if (!isTestEnv && mode === 'radius' && !hasInitializedRef.current && hasValidUserLocation) {
      try {
        map.setView([userLocation!.lat, userLocation!.lng], 14, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } catch {
        // noop
      }
    }

    // Radius mode: when userLocation becomes available/changes, allow auto-fit to run again.
    // This keeps default behavior: show results around current position (radius default is handled upstream).
    if (mode === 'radius' && hasValidUserLocation) {
      const key = `${userLocation!.lat.toFixed(6)},${userLocation!.lng.toFixed(6)}`;
      if (lastUserLocationKeyRef.current !== key) {
        lastUserLocationKeyRef.current = key;
        hasInitializedRef.current = false;
        lastAutoFitKeyRef.current = null;
      }
    }

    // Radius mode: if the selected radius changes, recompute the auto-fit view.
    // Otherwise switching between radius options may keep the previous zoom.
    if (mode === 'radius') {
      const r = Number(radiusInMeters);
      const radiusKey = Number.isFinite(r) && r > 0 ? String(Math.round(r)) : 'invalid-radius';
      if (lastRadiusKeyRef.current !== radiusKey) {
        lastRadiusKeyRef.current = radiusKey;
        hasInitializedRef.current = false;
        lastAutoFitKeyRef.current = null;
      }
    }

    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
    }

    // Radius mode: do NOT apply an initial zoom/center until radius results are ready.
    // The intended UX is to set the view only after points in the radius have been computed.
    if (!hasInitializedRef.current && hasRadiusResults) {
      // Prefer explicit circleCenter (radius mode), then user location, then provided coordinates.
      const hasValidCircleCenter =
        circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng);

      if (hasValidCircleCenter) {
        map.setView([circleCenter!.lat, circleCenter!.lng], 11, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidUserLocation) {
        map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      } else if (hasValidCoords) {
        map.setView([coordinates.lat, coordinates.lng], 11, { animate: false });
        requestAnimationFrame(() => syncZoomFromMap());
        hasInitializedRef.current = true;
      }
    }

    lastModeRef.current = mode;
  }, [
    map,
    mode,
    coordinates,
    userLocation,
    hasInitializedRef,
    lastModeRef,
    lastAutoFitKeyRef,
    syncZoomFromMap,
    hasRadiusResults,
    circleCenter,
    radiusInMeters,
  ]);

  // Fit bounds to all travel points (radius mode only)
  useEffect(() => {
    if (!map) return;
    if (disableFitBounds || mode === 'route') return;
    if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

    // Avoid auto-fit while radius results are not ready yet.
    if (!canAutoFitRadiusView) return;

    const dataKey = (travelData || [])
      .map((p) => (p.id != null ? `id:${p.id}` : `c:${p.coord}`))
      .join('|');
    const radiusKey = circleCenter && Number.isFinite(radiusInMeters)
      ? `r:${circleCenter.lat.toFixed(4)},${circleCenter.lng.toFixed(4)}:${Number(radiusInMeters).toFixed(0)}`
      : 'no-radius';
    const autoFitKey = `${mode}:${dataKey}:${userLocation ? `${userLocation.lat},${userLocation.lng}` : 'no-user'}:${radiusKey}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const hasValidCircle =
      mode === 'radius' &&
      circleCenter &&
      Number.isFinite(circleCenter.lat) &&
      Number.isFinite(circleCenter.lng) &&
      Number.isFinite(radiusInMeters) &&
      Number(radiusInMeters) > 0;

    const radiusMeters = hasValidCircle ? Number(radiusInMeters) : null;

    // Prefer fitting to actual point bounds when we have results.
    // Filter out extreme outliers, and (when circle is known) filter to points within the radius.
    const parsedPointCoords = (travelData || [])
      .map((p) => strToLatLng(p.coord, hintCenter))
      .filter(Boolean) as [number, number][];

    const filteredPointCoords = hasValidCircle
      ? parsedPointCoords.filter(([lng, lat]) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
          if (!CoordinateConverter.isValid({ lat, lng })) return false;
          try {
            const d = CoordinateConverter.distance(
              { lat: circleCenter!.lat, lng: circleCenter!.lng },
              { lat, lng }
            );
            // small tolerance to avoid dropping borderline points due to rounding
            return radiusMeters != null ? d <= radiusMeters * 1.05 : true;
          } catch {
            return false;
          }
        })
      : parsedPointCoords.filter(([lng, lat]) => CoordinateConverter.isValid({ lat, lng }));

    const shouldIgnoreRadiusFilter =
      hasValidCircle &&
      parsedPointCoords.length >= 20 &&
      filteredPointCoords.length > 0 &&
      filteredPointCoords.length < Math.max(10, Math.floor(parsedPointCoords.length * 0.2));

    // If filtering removed everything (or looks suspiciously small), fall back to unfiltered points.
    const usablePointCoords =
      filteredPointCoords.length === 0 || shouldIgnoreRadiusFilter
        ? parsedPointCoords
        : filteredPointCoords;

    const shouldFitToPoints = usablePointCoords.length > 0;
    const coords = shouldFitToPoints ? usablePointCoords : ([] as [number, number][]);

    if (coords.length === 0) {
      if (circleCenter && Number.isFinite(circleCenter.lat) && Number.isFinite(circleCenter.lng)) {
        coords.push([circleCenter.lng, circleCenter.lat]);
      } else if (userLocation) {
        coords.push([userLocation.lng, userLocation.lat]);
      }
    }

    // If we ended up with no usable points, fit to the circle bounds as a safe fallback.
    if (!shouldFitToPoints && hasValidCircle) {
      try {
        const circle = (L as any).circle([circleCenter.lat, circleCenter.lng], {
          radius: Number(radiusInMeters),
        });
        const circleBounds = circle.getBounds();
        const sw = circleBounds.getSouthWest();
        const ne = circleBounds.getNorthEast();
        coords.push([sw.lng, sw.lat]);
        coords.push([ne.lng, ne.lat]);
      } catch {
        // noop
      }
    }

    if (coords.length === 0) return;

    if (__DEV__ && mode === 'radius') {
      try {
        const samples = (travelData || []).slice(0, 5).map((p) => {
          const parsed = strToLatLng(p.coord, hintCenter);
          return { coord: p.coord, parsed };
        });
        console.info('[MapLogicComponent] radius fitBounds debug', {
          travelCount: (travelData || []).length,
          circleCenter,
          radiusInMeters,
          userLocation,
          fitMode: shouldFitToPoints ? 'points' : hasValidCircle ? 'circle' : 'none',
          sample: samples,
        });
      } catch {
        // noop
      }
    }

    try {
      const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
      const padding = fitBoundsPadding ?? {};

      // On web, layout (side panels, ResizeObserver, fonts) can change without a window resize.
      // If fitBounds runs before Leaflet sees the final container size, it may compute a wrong (too close) zoom.
      try {
        map.invalidateSize?.({ animate: false } as any);
      } catch {
        // noop
      }

      const runFit = () => {
        try {
          map.invalidateSize?.({ animate: false } as any);
        } catch {
          // noop
        }

        const maxZoom = mode === 'radius' ? 14 : undefined;
        map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom, ...padding } as any);

        // Sync zoom immediately after fitBounds so clustering doesn't run on stale mapZoom.
        requestAnimationFrame(() => syncZoomFromMap());
        lastAutoFitKeyRef.current = autoFitKey;
      };

      if (isTestEnv || typeof requestAnimationFrame !== 'function') {
        runFit();
      } else {
        requestAnimationFrame(runFit);
      }
    } catch {
      // noop
    }
  }, [
    map,
    disableFitBounds,
    mode,
    L,
    travelData,
    userLocation,
    circleCenter,
    radiusInMeters,
    fitBoundsPadding,
    lastAutoFitKeyRef,
    hintCenter,
    syncZoomFromMap,
    hasRadiusResults,
    canAutoFitRadiusView,
  ]);

  if (!debugEnabled) return null;

  const payload = debugSnapshot?.payload;
  const mapDump = payload?.map;
  const routeDump = payload?.route;
  const overlaysDump = payload?.overlays;

  const overlayItems: any[] = Array.isArray(overlaysDump?.overlays) ? overlaysDump.overlays : [];
  const overlayItemsShort = overlayItems.slice(0, 12);

  if (!debugOpen) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => {
            try {
              setDebugOpen(true);
              refreshDebugSnapshot('open');
            } catch {
              // noop
            }
          }}
          style={{
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.15)',
            background: 'rgba(255,255,255,0.92)',
            color: '#111',
          }}
        >
          Map debug
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10000,
        width: 360,
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: '60vh',
        overflow: 'auto',
        padding: 10,
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.15)',
        background: 'rgba(255,255,255,0.92)',
        color: '#111',
        fontSize: 12,
        lineHeight: 1.3,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Map debug</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => refreshDebugSnapshot('manual')}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              background: 'rgba(255,255,255,0.95)',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              void copyDebugJson();
            }}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              background: 'rgba(255,255,255,0.95)',
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() => setDebugOpen(false)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              background: 'rgba(255,255,255,0.95)',
            }}
          >
            Hide
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div>
          <b>Mode:</b> {String(mode)}
        </div>
        <div>
          <b>Center/zoom:</b>{' '}
          {mapDump?.center ? `${mapDump.center.lat.toFixed?.(5)}, ${mapDump.center.lng.toFixed?.(5)}` : 'n/a'} @{' '}
          {mapDump?.zoom ?? 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Route</div>
        <div>
          <b>ok:</b> {String(Boolean(routeDump?.ok))}
        </div>
        <div>
          <b>dLength:</b> {routeDump?.attrs?.dLength ?? 'n/a'}
        </div>
        <div>
          <b>rect:</b>{' '}
          {routeDump?.rect ? `${Math.round(routeDump.rect.width)}x${Math.round(routeDump.rect.height)}` : 'n/a'}
        </div>
        <div>
          <b>computed:</b>{' '}
          {routeDump?.computed
            ? `display=${routeDump.computed.display} visibility=${routeDump.computed.visibility} opacity=${routeDump.computed.opacity} strokeWidth=${routeDump.computed.strokeWidth}`
            : 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Panes</div>
        <div>
          <b>tilePane z:</b> {mapDump?.panes?.tilePane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>overlayPane z:</b> {mapDump?.panes?.overlayPane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>markerPane z:</b> {mapDump?.panes?.markerPane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>metravelRoutePane z:</b> {mapDump?.panes?.metravelRoutePane?.computedZIndex ?? 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Overlays</div>
        <div>
          <b>count:</b> {overlaysDump?.count ?? overlayItems.length}
        </div>
        <div style={{ marginTop: 6 }}>
          {overlayItemsShort.map((o) => (
            <div key={String(o?.id)} style={{ marginBottom: 4 }}>
              <b>{String(o?.id)}:</b> hasLayer={String(o?.hasLayer)}{' '}
              {o?.tileStats
                ? `tiles=${o.tileStats.loadedCount ?? 'n/a'}/${o.tileStats.imgCount ?? 'n/a'} z=${o.tileStats.containerZIndex ?? 'n/a'} op=${o.tileStats.containerOpacity ?? 'n/a'}`
                : ''}
            </div>
          ))}
          {overlayItems.length > overlayItemsShort.length && (
            <div style={{ opacity: 0.7 }}>… +{overlayItems.length - overlayItemsShort.length} more</div>
          )}
        </div>
      </div>
    </div>
  );
};
