// MapLogicComponent.tsx - Internal component for map event handling and initialization
import React, { useCallback, useEffect, useRef } from 'react';
import type { LatLng } from '@/types/coordinates';
import type { LeafletControlRef } from './leafletBridgeTypes';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';
import { beginProgrammaticMapMove } from './programmaticMoveSignal';

const isTestEnv =
  typeof process !== 'undefined' &&
  ((process as any).env?.NODE_ENV === 'test' ||
    (process as any).env?.JEST_WORKER_ID != null ||
    (globalThis as any)?.jest != null);

const AUTO_FIT_COORD_PRECISION = 3;

/**
 * #1348 — below this zoom a phone-width pane shows a whole region rather than "places
 * near me". z11 on a 390 px pane is ~17 km across: a city and its outskirts.
 *
 * It is a THRESHOLD, not a blanket floor: radii whose circle already fits above it
 * (≈10 km and below on a phone) keep the exact circle fit. Measured on the default
 * r=50 km: the fitted view is z8 and the first cluster request weighs 323 KB; z11
 * brings the same request down to ~118 KB, z10 only to ~243 KB.
 */
const COMPACT_MIN_FIT_ZOOM = 11;

/**
 * The first radius fit must run before the parent mounts the base tile layer.
 * Deferring it by one animation frame lets Leaflet request the MapContainer's
 * placeholder zoom first (z8/z11 on the default desktop flow), only to replace
 * it with the final z9 view immediately afterwards. Later fits may stay deferred
 * so layout changes can settle without changing the startup request contract.
 */
export const shouldDeferRadiusAutoFit = (hasCompletedAutoFit: boolean): boolean =>
  hasCompletedAutoFit && typeof requestAnimationFrame === 'function';

const getCoarseAutoFitLocationKey = (location?: LatLng | null): string => {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return 'no-location';
  }
  return `${location.lat.toFixed(AUTO_FIT_COORD_PRECISION)},${location.lng.toFixed(AUTO_FIT_COORD_PRECISION)}`;
};

/**
 * Compute geographic bounding box for a circle without requiring a Leaflet map instance.
 * L.circle().getBounds() needs the circle added to a map (uses layerPointToLatLng internally),
 * so we compute the bounds mathematically instead.
 */
function computeCircleBounds(
  center: { lat: number; lng: number },
  radiusMeters: number,
  L: any,
): any | null {
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return null;
  }
  const EARTH_RADIUS = 6371000; // meters
  const latDelta = (radiusMeters / EARTH_RADIUS) * (180 / Math.PI);
  const lngDelta =
    (radiusMeters / (EARTH_RADIUS * Math.cos((center.lat * Math.PI) / 180))) *
    (180 / Math.PI);

  const sw = { lat: center.lat - latDelta, lng: center.lng - lngDelta };
  const ne = { lat: center.lat + latDelta, lng: center.lng + lngDelta };

  if (L && typeof (L as any).latLngBounds === 'function' && typeof (L as any).latLng === 'function') {
    return (L as any).latLngBounds(
      (L as any).latLng(sw.lat, sw.lng),
      (L as any).latLng(ne.lat, ne.lng),
    );
  }
  return null;
}

interface Point {
  id?: string | number;
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
  /** Wait for the first result set before applying the initial web viewport. */
  initialResultsSettled?: boolean;
  /** Called once, synchronously after the initial viewport (or explicit fallback) is applied. */
  onInitialViewReady?: () => void;
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
  leafletControlRef: LeafletControlRef;
  useMap: () => any;
  useMapEvents: (handlers: any) => any;
  hintCenter?: LatLng | null;
  /**
   * #1348 — the map pane is narrow (phone / compact web). Fitting the WHOLE radius
   * circle into it lands at a country-scale zoom (r=50 km in 390 px ≈ z8), which
   * reads as "the map has no idea where I am". On a compact pane the auto-fit is
   * floored to a usable neighbourhood scale instead; the circle is then partly
   * off-screen by design and the user can zoom out to see all of it.
   */
  compactPane?: boolean;
}

export const MapLogicComponent: React.FC<MapLogicProps> = ({
  mapClickHandler,
  mode,
  coordinates,
  userLocation,
  disableFitBounds,
  L,
  travelData,
  initialResultsSettled = true,
  onInitialViewReady,
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
  compactPane = false,
}) => {
  const map = useMap();
  const hasCalledOnMapReadyRef = useRef(false);
  const lastUserLocationKeyRef = useRef<string | null>(null);
  const lastRadiusKeyRef = useRef<string | null>(null);
  const lastSyncedZoomRef = useRef<number | null>(null);
  const hasCompletedAutoFitRef = useRef(false);
  const hasSignaledInitialViewReadyRef = useRef(false);

  const hasRadiusResults = (travelData ?? []).length > 0;
  // Whether we know enough to draw/fit the radius circle around the user (or the
  // resolved center). When true the default radius view is "circle around me",
  // even with zero results — the circle must be visible from first paint.
  const hasValidRadiusCircle =
    mode === 'radius' &&
    !!circleCenter &&
    Number.isFinite(circleCenter.lat) &&
    Number.isFinite(circleCenter.lng) &&
    Number.isFinite(radiusInMeters) &&
    Number(radiusInMeters) > 0;
  const canAutoFitRadiusView = hasRadiusResults || hasValidRadiusCircle;

  const signalInitialViewReady = useCallback(() => {
    if (hasSignaledInitialViewReadyRef.current) return;
    hasSignaledInitialViewReadyRef.current = true;
    onInitialViewReady?.();
  }, [onInitialViewReady]);

  // Helper: ensure mapZoom state matches real leaflet zoom even after programmatic moves.
  // Only push state when the zoom actually changed — a plain pan (moveend) keeps the
  // same zoom, and re-setting identical state would re-render the whole map tree.
  const syncZoomFromMap = useCallback(() => {
    try {
      if (!map) return;
      const z = map.getZoom?.();
      if (!Number.isFinite(z)) return;
      if (z === lastSyncedZoomRef.current) return;
      lastSyncedZoomRef.current = z;
      setMapZoom(z);
    } catch {
      // noop
    }
  }, [map, setMapZoom]);

  // Handle map events. Only zoomend syncs zoom state — moveend (pan) keeps the same
  // zoom, so calling setMapZoom there only churned the React tree on every pan.
  useMapEvents({
    click: mapClickHandler,
    zoomend: () => {
      syncZoomFromMap();
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
  }, [map, mapRef, onMapReady, setMapZoom, syncZoomFromMap]);

  // Popup dismissal on zoomstart is handled once, via the useMapEvents `zoomstart`
  // handler above. The map `click` popup-close is intentionally NOT re-registered
  // here: `mapClickHandler` (wired through useMapEvents) owns click semantics
  // (background-tap dismissal + tap-guard), and Leaflet already closes the popup
  // on marker/background click. A second manual subscription only doubled the
  // work on every zoom start.

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
      let hasAppliedRouteView = hasInitializedRef.current;
      if (!hasInitializedRef.current && hasValidCoords) {
        try {
          beginProgrammaticMapMove();
          map.setView([coordinates.lat, coordinates.lng], 13, { animate: false });
          hasInitializedRef.current = true;
          hasAppliedRouteView = true;
        } catch {
          // Pane may not be ready yet
        }
        // ensure clusters get correct zoom after programmatic set
        requestAnimationFrame(() => syncZoomFromMap());
      }
      if (initialResultsSettled && hasAppliedRouteView) signalInitialViewReady();
      lastModeRef.current = mode;
      return;
    }

    // #1291 — radius mode has NO intermediate setView any more. Раньше здесь были
    // два шага: pre-fit на радиусный зум до прихода результатов и повтор того же
    // зума после них. Оба немедленно перекрывались авто-фитом ниже, но Leaflet
    // успевал скачать тайлы промежуточного уровня (r=50 км → z13), которые
    // пользователь никогда не видел: холодный старт трогал три зум-уровня.
    // Авто-фит и так срабатывает по одному валидному кругу, без результатов
    // (`canAutoFitRadiusView`), поэтому «круг вокруг меня» виден с первого кадра,
    // а стартовый вид применяется ровно один раз — сразу конечным.

    // Radius mode: allow one auto-fit when trusted userLocation first becomes
    // available. Live ticks must not repeatedly reset the viewport after a
    // deliberate pan; follow-mode performs its own explicit recentering.
    if (mode === 'radius' && hasValidUserLocation) {
      const key = getCoarseAutoFitLocationKey(userLocation);
      if (lastUserLocationKeyRef.current === null) {
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

    // Возврат из route в radius: маршрутный fitBounds увёл карту в коридор
    // маршрута, поэтому радиусный вид надо применить заново. Сбрасываем и ключ
    // авто-фита — теперь стартовый вид применяет только он, и без сброса ключа
    // эффект вышел бы на «уже фитил этот ключ» и карта осталась бы на маршруте.
    if (lastModeRef.current === 'route' && mode === 'radius') {
      hasInitializedRef.current = false;
      lastAutoFitKeyRef.current = null;
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
    radiusInMeters,
    initialResultsSettled,
    signalInitialViewReady,
  ]);

  // Fit bounds to all travel points (radius mode only)
  useEffect(() => {
    if (!map) return;
    // #1291 — fitting an empty loading placeholder first produced z8, then the
    // settled result set produced z9. Keep the base layer detached until the
    // first real result set can choose the one initial viewport.
    if (!initialResultsSettled) return;
    if (disableFitBounds || mode === 'route') return;
    if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

    // Avoid auto-fit while radius results are not ready yet.
    if (!canAutoFitRadiusView) return;

    // #1350 — the key deliberately does NOT include the point composition. It used
    // to be `travelData.map(id|coord).join('|')`, and because the radius query is an
    // infinite list (the mobile places sheet calls onLoadMore) EVERY extra page and
    // every background refetch produced a new key — i.e. an auto-fit right on top of
    // the zoom the user had just set by hand. What legitimately re-fits is: the mode,
    // the search anchor, the radius, and the first arrival of results.
    const radiusKey = circleCenter && Number.isFinite(radiusInMeters)
      ? `r:${getCoarseAutoFitLocationKey(circleCenter)}:${Number(radiusInMeters).toFixed(0)}`
      : 'no-radius';
    const initialLocationKey = lastUserLocationKeyRef.current ?? getCoarseAutoFitLocationKey(userLocation);
    const resultsKey = hasRadiusResults ? 'results' : 'empty';
    const autoFitKey = `${mode}:${resultsKey}:${initialLocationKey}:${radiusKey}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const hasValidCircle = hasValidRadiusCircle;

    const radiusMeters = hasValidCircle ? Number(radiusInMeters) : null;

    // Radius-circle bounds (computed once). In radius mode this is the DEFAULT
    // view: the map must show the whole circle around the user, never wider.
    const circleBounds =
      hasValidCircle && circleCenter
        ? computeCircleBounds(
            { lat: circleCenter.lat, lng: circleCenter.lng },
            Number(radiusInMeters),
            L,
          )
        : null;

    // Point bounds are only used to TIGHTEN the view when every result sits
    // comfortably inside the circle — we never let them widen past the circle.
    const parsedPointCoords = (travelData || [])
      .map((p) => strToLatLng(p.coord, hintCenter))
      .filter(Boolean) as [number, number][];

    const inRadiusPointCoords = hasValidCircle
      ? parsedPointCoords.filter(([lng, lat]) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
          if (!CoordinateConverter.isValid({ lat, lng })) return false;
          try {
            const d = CoordinateConverter.distance(
              { lat: circleCenter!.lat, lng: circleCenter!.lng },
              { lat, lng }
            );
            return radiusMeters != null ? d <= radiusMeters * 1.05 : true;
          } catch {
            return false;
          }
        })
      : parsedPointCoords.filter(([lng, lat]) => CoordinateConverter.isValid({ lat, lng }));

    // Decide the target bounds.
    // - Radius mode with a valid circle: ALWAYS the circle, optionally intersected
    //   (tightened) with the in-radius point bounds so a tight cluster zooms in,
    //   but the result is clamped to the circle (never wider).
    // - Otherwise (no circle): fit to whatever valid points we have.
    let targetBounds: any = null;

    if (hasValidCircle && circleBounds) {
      targetBounds = circleBounds;

      if (inRadiusPointCoords.length > 0) {
        try {
          const pointBounds = (L as any).latLngBounds(
            inRadiusPointCoords.map(([lng, lat]) => (L as any).latLng(lat, lng)),
          );
          // Always include the user/center so the "you" marker stays in view.
          pointBounds.extend((L as any).latLng(circleCenter!.lat, circleCenter!.lng));
          // Clamp to the circle: the tightened view can be smaller than the
          // circle but must never exceed it.
          const sw = pointBounds.getSouthWest();
          const ne = pointBounds.getNorthEast();
          const cSw = circleBounds.getSouthWest();
          const cNe = circleBounds.getNorthEast();
          const clampedSw = (L as any).latLng(
            Math.max(sw.lat, cSw.lat),
            Math.max(sw.lng, cSw.lng),
          );
          const clampedNe = (L as any).latLng(
            Math.min(ne.lat, cNe.lat),
            Math.min(ne.lng, cNe.lng),
          );
          const clamped = (L as any).latLngBounds(clampedSw, clampedNe);
          if (clamped.isValid?.() ?? true) targetBounds = clamped;
        } catch {
          targetBounds = circleBounds;
        }
      }
    } else {
      const coords =
        inRadiusPointCoords.length > 0
          ? inRadiusPointCoords
          : userLocation
            ? ([[userLocation.lng, userLocation.lat]] as [number, number][])
            : ([] as [number, number][]);
      if (coords.length === 0) {
        signalInitialViewReady();
        return;
      }
      try {
        targetBounds = (L as any).latLngBounds(
          coords.map(([lng, lat]) => (L as any).latLng(lat, lng)),
        );
      } catch {
        signalInitialViewReady();
        return;
      }
    }

    if (!targetBounds) {
      signalInitialViewReady();
      return;
    }

    let cancelled = false;
    let scheduledFitFrame: number | null = null;
    let initialFitRetryCount = 0;

    try {
      const bounds = targetBounds;
      const padding = fitBoundsPadding ?? {};

      // On web, layout (side panels, ResizeObserver, fonts) can change without a window resize.
      // If fitBounds runs before Leaflet sees the final container size, it may compute a wrong (too close) zoom.
      try {
        map.invalidateSize?.({ animate: false } as any);
      } catch {
        // noop
      }

      const scheduleFit = (run: () => void): boolean => {
        if (typeof requestAnimationFrame !== 'function') return false;
        scheduledFitFrame = requestAnimationFrame(() => {
          scheduledFitFrame = null;
          run();
        });
        return true;
      };

      const runFit = () => {
        if (cancelled) return;
        try {
          map.invalidateSize?.({ animate: false } as any);
        } catch {
          // noop
        }

        // Guard: if the map container was removed from the DOM (route change, unmount),
        // fitBounds will crash with "Cannot set properties of undefined ('_leaflet_pos')".
        // Release the claimed key so a later effect run can retry the fit.
        if (!isTestEnv) {
          try {
            const container: HTMLElement | undefined = map.getContainer?.();
            if (!container || !container.isConnected) {
              lastAutoFitKeyRef.current = null;
              return;
            }
          } catch {
            lastAutoFitKeyRef.current = null;
            return;
          }
        }

        const maxZoom = mode === 'radius' ? 16 : undefined;
        // Radius mode: a small uniform pad gives the circle breathing room so it
        // never touches the map edges. It only zooms out slightly around the same
        // center (the user marker stays centered) — it does NOT widen the target
        // to far-away points, so the "never wider than the circle" contract holds.
        const padFactor = mode === 'radius' ? 0.1 : 0.12;
        try {
          const paddedBounds = bounds.pad(padFactor);
          const animate = !isTestEnv && hasCompletedAutoFitRef.current;
          // Mark this as self-induced motion so the cluster viewport snapshot
          // ignores the moveend/zoomend it fires (prevents the fit⇄data flicker
          // loop). Cover the animated flyTo duration when animating.
          beginProgrammaticMapMove(animate ? 700 : 500);

          // #1348 — a narrow pane cannot show a wide radius circle at a useful scale:
          // r=50 km in 390 px fits at z8, i.e. half a region, and the user reads that
          // as "the map has no idea where I am". Rescue ONLY the genuinely regional
          // case (below COMPACT_MIN_FIT_ZOOM); small radii still get their exact
          // circle fit, which is what the fit contract is for.
          if (mode === 'radius' && compactPane && typeof map.getBoundsZoom === 'function') {
            const fittedZoom = Number(map.getBoundsZoom(paddedBounds, false));
            const center =
              typeof paddedBounds.getCenter === 'function' ? paddedBounds.getCenter() : null;
            if (Number.isFinite(fittedZoom) && fittedZoom < COMPACT_MIN_FIT_ZOOM && center) {
              // fitBounds honours the asymmetric padding that keeps the circle clear of
              // the bottom sheet; setView does not, so shift the centre up by half the
              // reserved strip ourselves.
              const bottomReserve = Number((padding as any)?.paddingBottomRight?.[1] ?? 0);
              let target = center;
              if (
                Number.isFinite(bottomReserve) &&
                bottomReserve > 0 &&
                typeof map.project === 'function' &&
                typeof map.unproject === 'function'
              ) {
                try {
                  const projected = map.project(center, COMPACT_MIN_FIT_ZOOM);
                  projected.y += bottomReserve / 2;
                  target = map.unproject(projected, COMPACT_MIN_FIT_ZOOM);
                } catch {
                  target = center;
                }
              }
              map.setView(target, COMPACT_MIN_FIT_ZOOM, {
                animate,
                duration: animate ? 0.35 : undefined,
              } as any);
              requestAnimationFrame(() => syncZoomFromMap());
              hasCompletedAutoFitRef.current = true;
              // #1291 — авто-фит стал единственным, кто применяет стартовый вид в
              // radius-режиме, поэтому именно он и отмечает «вид применён».
              // Иначе флаг навсегда остался бы false и вход в route-режим каждый
              // раз телепортировал бы карту на анкер поиска в z13.
              hasInitializedRef.current = true;
              signalInitialViewReady();
              return;
            }
          }

          map.fitBounds(paddedBounds, {
            animate,
            duration: animate ? 0.35 : undefined,
            maxZoom,
            ...padding,
          } as any);
        } catch {
          // Pane element may not be ready yet (e.g. _mapPane is undefined).
          // A first-frame failure is retryable: enabling the base layer here would
          // request placeholder-zoom tiles before the real fit. Retry once on the
          // next frame; only then accept MapContainer's view as an explicit fallback.
          if (!hasCompletedAutoFitRef.current && initialFitRetryCount < 1) {
            initialFitRetryCount += 1;
            if (scheduleFit(runFit)) return;
          }
          // Later fits remain retryable on a future dependency/event pass. The
          // exhausted initial attempt keeps its claimed key because the fallback
          // is now the chosen startup view and must not trigger a surprise re-fit.
          if (hasCompletedAutoFitRef.current) lastAutoFitKeyRef.current = null;
          signalInitialViewReady();
          return;
        }

        // Sync zoom immediately after fitBounds so clustering doesn't run on stale mapZoom.
        requestAnimationFrame(() => syncZoomFromMap());
        hasCompletedAutoFitRef.current = true;
        // См. комментарий выше: стартовый вид применён — вход в route-режим не
        // должен переустанавливать вид поверх него.
        hasInitializedRef.current = true;
        signalInitialViewReady();
      };

      // #1350 — claim the key BEFORE the deferred run. `lastAutoFitKeyRef` used to be
      // written inside `runFit`, so another effect pass in the same frame saw an
      // unclaimed key and queued a second fitBounds on top of the first.
      lastAutoFitKeyRef.current = autoFitKey;

      if (!isTestEnv && shouldDeferRadiusAutoFit(hasCompletedAutoFitRef.current)) {
        scheduleFit(runFit);
      } else {
        runFit();
      }
    } catch {
      signalInitialViewReady();
    }

    return () => {
      cancelled = true;
      if (scheduledFitFrame != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(scheduledFitFrame);
      }
      // If a first-fit retry was cancelled by a newer result/anchor before it
      // ran, release the claim. Otherwise the replacement effect sees the same
      // coarse key and assumes a viewport that was never actually applied.
      if (
        scheduledFitFrame != null &&
        !hasCompletedAutoFitRef.current &&
        !hasSignaledInitialViewReadyRef.current
      ) {
        lastAutoFitKeyRef.current = null;
      }
    };
  }, [
    map,
    initialResultsSettled,
    disableFitBounds,
    mode,
    L,
    travelData,
    userLocation,
    circleCenter,
    radiusInMeters,
    fitBoundsPadding,
    lastAutoFitKeyRef,
    hasInitializedRef,
    hintCenter,
    syncZoomFromMap,
    hasRadiusResults,
    hasValidRadiusCircle,
    canAutoFitRadiusView,
    compactPane,
    signalInitialViewReady,
  ]);

  // Explicit settled fallback for views that intentionally skip radius fitting
  // (route mode, disabled fit, missing Leaflet bounds helpers, or no valid target).
  // This effect is declared after the fit effect so a valid radius always applies
  // its final viewport before the base layer can be enabled.
  useEffect(() => {
    if (!map || !initialResultsSettled || hasSignaledInitialViewReadyRef.current) return;

    const canAttemptRadiusFit =
      mode === 'radius' &&
      !disableFitBounds &&
      !!L &&
      typeof L.latLngBounds === 'function' &&
      typeof L.latLng === 'function' &&
      canAutoFitRadiusView;

    if (!canAttemptRadiusFit) signalInitialViewReady();
  }, [
    map,
    initialResultsSettled,
    mode,
    disableFitBounds,
    L,
    canAutoFitRadiusView,
    signalInitialViewReady,
  ]);
  return null;
};
