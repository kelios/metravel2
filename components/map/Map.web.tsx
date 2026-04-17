// app/Map.tsx (бывш. MapClientSideComponent) — ультралёгкая web-карта
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';

import { useLeafletIcons } from '@/components/MapPage/Map/useLeafletIcons';
import { fetchFilters } from '@/api/misc';
import {
  CategoryDictionaryItem,
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames,
} from '@/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/utils/travelPointMeta';
import { normalizePoint } from '@/components/map-core';
import type { LegacyMapPoint, Coordinates } from '@/components/map-core';
import MapPopup from '@/components/map-core/MapPopup';
import { getPopupCss } from '@/components/map-core/mapPopupStyles';
import { useMapLifecycle, hasMapPane } from '@/components/map-core/useMapLifecycle';

/** @deprecated Use LegacyMapPoint from map-core. Kept for backward compat. */
export type Point = LegacyMapPoint;

type TravelPropsType = {
  data?: LegacyMapPoint[];
};


interface MapClientSideProps {
  travel?: TravelPropsType;
  coordinates?: Coordinates | null;
  showRoute?: boolean;
  highlightedPointRequest?: { coord: string; key: string };
}

const normalizeCoordKey = (coord?: string | null) => {
  if (!coord) return '';
  return coord.replace(/;/g, ',').replace(/\s+/g, '').trim();
};

const parseCoordKey = (coordKey: string): [number, number] | null => {
  const [latStr, lngStr] = coordKey.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};


const getCountryFromAddress = (address?: string | null) => {
  const addr = String(address ?? '').trim();
  if (!addr) return '';
  return (
    addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(-1)[0] ?? ''
  );
};

const stripCountryFromCategoryNames = (names: string[], address?: string | null) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return names;
  return names.filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);
};

const stripCountryFromCategoryIds = (
  ids: string[],
  address: string | null | undefined,
  idToNameMap: Map<string, string>
) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return ids;
  return ids.filter((id) => {
    const idText = String(id ?? '').trim();
    const name = String(idToNameMap.get(idText) ?? '').trim();
    if (!name) {
      if (!idText) return true;
      return idText.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
    }
    return name.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
  });
};

// Карточка попапа на карте

const isWeb = Platform.OS === 'web';
const getLatLng = (latlng: string): [number, number] | null => {
  if (!latlng) return null;
  const [lat, lng] = latlng.split(',').map(Number);
  return isNaN(lat) || isNaN(lng) ? null : [lat, lng];
};

type LeafletNS = typeof import('leaflet');
type ReactLeafletNS = typeof import('react-leaflet');


const MapClientSideComponent: React.FC<MapClientSideProps> = ({
                                                                travel = { data: [] },
                                                                coordinates = { latitude: 53.8828449, longitude: 27.7273595 },
                                                                highlightedPointRequest,
                                                              }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const popupBottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset());

  const [L, setL] = useState<LeafletNS | null>(null);
  const [rl, setRl] = useState<ReactLeafletNS | null>(null);

  const rootRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const { mapInstanceKeyRef, mapContainerIdRef } = useMapLifecycle({ rootRef, mapRef });
  const markersRef = useRef<Map<string, any>>(new Map());
  const userLocationRef = useRef<any>(null);
  const pendingHighlightRef = useRef<{ coordKey: string; requestKey: string } | null>(null);
  const siteCategoryDictionaryRef = useRef<CategoryDictionaryItem[]>([]);
  const [mapPaneWidth, setMapPaneWidth] = useState(0);
  const [categoryDictionaryVersion, setCategoryDictionaryVersion] = useState(0);
  const categoryIdToName = useMemo(() => {
    if (categoryDictionaryVersion === -1) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const entry of siteCategoryDictionaryRef.current) {
      const id = String(entry.id ?? '').trim();
      const name = String(entry.name ?? '').trim();
      if (!id || !name) continue;
      map.set(id, name);
    }
    return map;
  }, [categoryDictionaryVersion]);


  useEffect(() => {
    let active = true;
    const loadDictionary = async () => {
      try {
        const data = await fetchFilters();
        const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
        if (!active) return;
        siteCategoryDictionaryRef.current = normalizeCategoryDictionary(raw);
        setCategoryDictionaryVersion((prev) => prev + 1);
      } catch {
        if (active) {
          siteCategoryDictionaryRef.current = [];
          setCategoryDictionaryVersion((prev) => prev + 1);
        }
      }
    };
    loadDictionary();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isWeb) return;

    const hostEl = rootRef.current as HTMLElement | null;
    if (!(hostEl instanceof HTMLElement)) return;

    const updateWidth = () => {
      setMapPaneWidth(hostEl.clientWidth || 0);
    };

    updateWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });
      resizeObserver.observe(hostEl);
    }

    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const openMarkerPopup = useCallback((marker: any, mapInstance?: any) => {
    try {
      marker.openPopup();
      const latLng = marker.getLatLng ? marker.getLatLng() : null;
      const map = mapInstance ?? mapRef.current;
      if (map && latLng) {
        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
        map.flyTo(latLng, Math.max(currentZoom, 13), { animate: true, duration: 0.35 } as any);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!highlightedPointRequest) return;
    const normalizedKey = normalizeCoordKey(highlightedPointRequest.coord);
    if (!normalizedKey) return;
    const marker = markersRef.current.get(normalizedKey);
    if (!marker) {
      const parsed = parseCoordKey(normalizedKey);
      const mapInstance = mapRef.current;
      if (parsed && mapInstance && typeof mapInstance.eachLayer === 'function') {
        const [targetLat, targetLng] = parsed;
        let found: any = null;
        mapInstance.eachLayer((layer: any) => {
          if (found) return;
          const latLng = layer?.getLatLng?.();
          if (!latLng) return;
          const lat = Number(latLng.lat ?? latLng[0]);
          const lng = Number(latLng.lng ?? latLng[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          if (Math.abs(lat - targetLat) < 1e-6 && Math.abs(lng - targetLng) < 1e-6) {
            found = layer;
          }
        });
        if (found) {
          pendingHighlightRef.current = null;
          openMarkerPopup(found, mapInstance);
          return;
        }
      }
      pendingHighlightRef.current = {
        coordKey: normalizedKey,
        requestKey: highlightedPointRequest.key,
      };
      return;
    }
    pendingHighlightRef.current = null;
    openMarkerPopup(marker);
  }, [highlightedPointRequest, openMarkerPopup]);



  // очень лёгкая инициализация: грузим libs на idle, как только компонент смонтирован
  useEffect(() => {
    if (!isWeb) return;
    let cancelled = false;
    ;(async () => {
      try {
        const [{ ensureLeafletCss }, runtime] = await Promise.all([
          import('@/utils/ensureLeafletCss'),
          import('@/utils/loadLeafletRuntime').then(({ loadLeafletRuntime }) => loadLeafletRuntime()),
        ]);
        ensureLeafletCss();
        if (cancelled) return;
        setL(runtime.L as any);
        setRl(runtime.RL as any);
      } catch {
        if (!cancelled) {
          setL(null);
          setRl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const travelData = useMemo(() => {
    const rawData = Array.isArray(travel?.data) ? travel.data : [];
    return rawData.map((p: any, idx: number) => normalizePoint(p, idx));
  }, [travel]);

  const initialCenter: [number, number] = [
    coordinates?.latitude ?? 53.8828449,
    coordinates?.longitude ?? 27.7273595,
  ];

  const popupContentMaxWidth = useMemo(() => {
    if (!mapPaneWidth) return 320;
    if (mapPaneWidth <= 420) {
      return Math.max(220, Math.min(280, mapPaneWidth - 24));
    }
    return Math.max(220, Math.min(320, mapPaneWidth - 56));
  }, [mapPaneWidth]);

  const popupMinWidth = useMemo(() => {
    if (popupContentMaxWidth <= 280) {
      return Math.max(160, Math.min(200, popupContentMaxWidth - 24));
    }
    return Math.max(180, Math.min(220, popupContentMaxWidth - 32));
  }, [popupContentMaxWidth]);

  const popupHorizontalPadding = useMemo(() => {
    if (!mapPaneWidth) return 24;
    return mapPaneWidth <= 420 ? 12 : 24;
  }, [mapPaneWidth]);

  const leafletIcons = useLeafletIcons(L);

  const siteMarkerIcon = useMemo(() => {
    if (leafletIcons?.meTravel) return leafletIcons.meTravel;
    return null;
  }, [leafletIcons]);

  const renderPlaceholder = () => (
    <View style={[styles.mapContainer, styles.placeholderContainer]}>
      <View style={styles.placeholderSkeleton} />
    </View>
  );

  if (!isWeb) {
    return <Text style={{ padding: 20 }}>Карта доступна только в браузере</Text>;
  }

  if (!L || !rl || !siteMarkerIcon) {
    return renderPlaceholder();
  }

  const RL = rl as any;
  const MapContainerC = RL.MapContainer;
  const TileLayerC = RL.TileLayer;
  const MarkerC = RL.Marker;
  const PopupC = RL.Popup;
  const useMapHook = RL.useMap;



  const LocateUserControl: React.FC = () => {
    const map = useMapHook?.();
    const [locating, setLocating] = useState(false);

    const handleLocate = useCallback(() => {
      if (!map || !navigator?.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const latlng = L.latLng(latitude, longitude);
          map.flyTo(latlng, 14, { animate: true, duration: 0.5 });
          if (userLocationRef.current) {
            userLocationRef.current.setLatLng(latlng);
          } else {
            const circle = L.circleMarker(latlng, {
              radius: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              color: '#fff',
              weight: 3,
            }).addTo(map);
            userLocationRef.current = circle;
          }
          setLocating(false);
        },
        () => {
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }, [map]);

    return (
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 10,
          zIndex: 1000,
          cursor: 'pointer',
          width: 34,
          height: 34,
          backgroundColor: '#fff',
          borderRadius: 4,
          border: '2px solid rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: locating ? 0.6 : 1,
        }}
        onClick={handleLocate}
        title="Моё местоположение"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </div>
    );
  };

  const FitBoundsOnData: React.FC<{ data: LegacyMapPoint[] }> = ({ data }) => {
    const map = useMapHook?.();

    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__metravelLeafletMap = map;
      }

      if (!hasMapPane(map)) return;

      const coords = data
        .map((p) => getLatLng(p.coord))
        .filter(
          (c): c is [number, number] =>
            Array.isArray(c) &&
            c.length === 2 &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1])
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
          // малый padding, чтобы не было резких анимаций
          map.fitBounds(bounds, { padding: [32, 32], animate: false });
        } catch {
          // noop
        }
      };

      if (typeof map.whenReady === 'function') {
        map.whenReady(run);
      } else {
        run();
      }
    }, [map, data]);
    return null;
  };

  const MarkerWithPopup: React.FC<{ point: Point; latLng: [number, number] }> = ({ point, latLng }) => {
    const map = useMapHook?.();
    const markerRef = useRef<any>(null);
    const normalizedKey = useMemo(() => normalizeCoordKey(point.coord), [point.coord]);

    useEffect(() => {
      const marker = markerRef.current;
      if (!marker || !normalizedKey) return;
      markersRef.current.set(normalizedKey, marker);
      const pending = pendingHighlightRef.current;
      if (pending && pending.coordKey === normalizedKey) {
        pendingHighlightRef.current = null;
        openMarkerPopup(marker, map);
      }
      return () => {
        markersRef.current.delete(normalizedKey);
      };
    }, [map, normalizedKey]);

    const handleMarkerClick = useCallback(() => {
      if (!hasMapPane(map)) return;

      try {
        if (typeof map.flyTo === 'function') {
          map.flyTo(latLng, map.getZoom(), { animate: true, duration: 0.35 } as any);
        } else if (typeof map.setView === 'function') {
          map.setView(latLng, map.getZoom(), { animate: true } as any);
        }
      } catch {
        // noop
      }
    }, [latLng, map]);

    return (
      <MarkerC
        key={`${point.id}`}
        position={latLng}
        icon={siteMarkerIcon}
        eventHandlers={{
          click: handleMarkerClick,
        }}
        ref={markerRef}
      >
        <PopupWithClose point={point} />
      </MarkerC>
    );
  };

  // Компонент для центрирования карты при открытии попапа
  const MapCenterOnPopup: React.FC = () => {
    const map = useMapHook?.();

    const handlePopupOpen = useCallback(
      (e: any) => {
        if (!hasMapPane(map)) return;

        const popup = e?.popup;
        const popupEl: HTMLElement | null = popup?.getElement ? popup.getElement() : null;
        const mapEl: HTMLElement | null = map?.getContainer ? map.getContainer() : null;
        if (!popupEl || !mapEl) return;

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
            const bottomSafePadding = isNarrowMap
              ? Math.min(
                  Math.max(verticalPadding, popupBottomOffset + 20),
                  Math.max(verticalPadding, Math.round(mapRect.height * 0.4))
                )
              : verticalPadding;
            let dx = 0;
            let dy = 0;

            const popupCenterX = popupRect.left + popupRect.width / 2;
            const popupCenterY = popupRect.top + popupRect.height / 2;
            const safeLeft = horizontalPadding;
            const safeRight = mapRect.width - horizontalPadding;
            const safeTop = verticalPadding;
            const safeBottom = mapRect.height - bottomSafePadding;
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

            // Избегаем микродвижений (дергания)
            if (Math.abs(dx) < 6) dx = 0;
            if (Math.abs(dy) < 6) dy = 0;
            if (!dx && !dy) return;

            if (typeof map.panBy === 'function') {
              map.panBy([dx, dy], { animate: true, duration: 0.35 } as any);
            }
          } catch {
            // noop
          }
        };

        let rafId = 0;
        const scheduleRun = () => {
          if (typeof window === 'undefined') return;
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
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            cleanupTimer = null;
          }
          if (typeof map?.off === 'function') {
            map.off('popupclose', cleanup);
          }
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

        if (typeof map?.on === 'function') {
          map.on('popupclose', cleanup);
        }

        cleanupTimer = setTimeout(cleanup, 1000);
      },
      [map]
    );

    useEffect(() => {
      // Слушаем событие открытия попапа
      map.on('popupopen', handlePopupOpen);

      return () => {
        map.off('popupopen', handlePopupOpen);
      };
    }, [map, handlePopupOpen]);

    return null;
  };

  // Компонент для управления закрытием попапа
  const PopupWithClose: React.FC<{ point: LegacyMapPoint }> = ({ point }) => {
    const map = useMapHook?.();
    const [forceClosed, setForceClosed] = useState(false);

    // Reset forceClosed when popup re-opens
    useEffect(() => {
      if (!map) return;
      const onOpen = () => setForceClosed(false);
      map.on('popupopen', onOpen);
      return () => { map.off('popupopen', onOpen); };
    }, [map]);

    const handleClose = useCallback(() => {
      // Immediately hide the fullscreen overlay portal, then close Leaflet popup
      setForceClosed(true);
      map?.closePopup();
    }, [map]);

    /* eslint-disable react-hooks/exhaustive-deps */
    const resolveCategoryInfo = useCallback((p: LegacyMapPoint) => {
      const categoryNames = stripCountryFromCategoryNames(getPointCategoryNames(p), p.address);
      const categoryLabel = categoryNames.join(', ');
      const nameToIdsMap = createCategoryNameToIdsMap(siteCategoryDictionaryRef.current);
      const resolvedFromNames = resolveCategoryIdsByNames(categoryNames, nameToIdsMap);
      const idsFromPoint = getPointCategoryIds(p);
      const combinedIds = Array.from(new Set([...idsFromPoint, ...resolvedFromNames]));
      const filteredIds = stripCountryFromCategoryIds(combinedIds, p.address, categoryIdToName);
      return { categoryLabel, categoryIds: filteredIds };
    }, [categoryDictionaryVersion, categoryIdToName]);
    /* eslint-enable react-hooks/exhaustive-deps */

    return (
      <PopupC
        autoPan
        keepInView
        maxWidth={popupContentMaxWidth}
        minWidth={popupMinWidth}
        autoPanPadding={[popupHorizontalPadding, 24] as any}
        autoPanPaddingTopLeft={[popupHorizontalPadding, 72] as any}
        autoPanPaddingBottomRight={[popupHorizontalPadding, 72] as any}
        closeButton
      >
        {!forceClosed && (
          <MapPopup
            point={point}
            onClose={handleClose}
            resolveCategoryInfo={resolveCategoryInfo}
          />
        )}
      </PopupC>
    );
  };

  return (
    <View
      style={[
        styles.mapContainer,
        { ['--metravel-popup-content-max-width' as any]: `${popupContentMaxWidth}px` } as any,
      ]}
      ref={rootRef}
      {...({ className: 'metravel-travel-map' } as any)}
    >
      <style>
        {getPopupCss('.metravel-travel-map', colors as any)}
      </style>
      <MapContainerC
        center={initialCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        id={mapContainerIdRef.current}
        key={mapInstanceKeyRef.current}
        // чутка экономим на анимациях
        preferCanvas
        ref={(map: any) => {
          if (!map || mapRef.current === map) return;
          mapRef.current = map;
          try {
            const el = map?.getContainer?.() as any;
            if (el) {
              el._leaflet_map = map;
            }
          } catch {
            // noop
          }
          // Tiles may not render when the map is mounted into a container that
          // was just made visible (e.g. tab switch). invalidateSize forces
          // Leaflet to recalculate the viewport and request the correct tiles.
          try {
            requestAnimationFrame(() => {
              try { map.invalidateSize(true); } catch { /* noop */ }
            });
            setTimeout(() => {
              try { map.invalidateSize(true); } catch { /* noop */ }
            }, 200);
            setTimeout(() => {
              try { map.invalidateSize(true); } catch { /* noop */ }
            }, 600);
          } catch {
            // noop
          }
        }}
      >
        <TileLayerC
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CartoDB"
          crossOrigin="anonymous"
        />
        <FitBoundsOnData data={travelData} />
        <MapCenterOnPopup />
        <LocateUserControl />
        {travelData.map((point) => {
          const latLng = getLatLng(point.coord);
          if (!latLng) return null;
          return (
            <MarkerWithPopup key={`${point.id}`} point={point} latLng={latLng} />
          );
        })}
      </MapContainerC>
    </View>
  );
};

export default React.memo(MapClientSideComponent);

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  mapContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    minHeight: 400,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderSkeleton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    opacity: 0.9,
  },
});
