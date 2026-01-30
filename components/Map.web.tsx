// app/Map.tsx (бывш. MapClientSideComponent) — ультралёгкая web-карта
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Leaflet/react-leaflet через Metro (без CDN)
import Leaflet from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import '@/src/utils/leafletFix';

import PlacePopupCard from '@/components/MapPage/Map/PlacePopupCard';
import { useLeafletIcons } from '@/components/MapPage/Map/useLeafletIcons';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/src/utils/toast';
import { userPointsApi } from '@/src/api/userPoints';
import { PointStatus } from '@/types/userPoints';
import { fetchFilters } from '@/src/api/misc';
import {
  CategoryDictionaryItem,
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames,
} from '@/src/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/src/utils/travelPointMeta';

const LEAFLET_MAP_CONTAINER_ID_PREFIX = 'metravel-leaflet-map';
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type Point = {
  id: string;
  coord: string;
  address: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  category?: string | number | Array<string | { name?: string }>;
  categoryId?: string | number;
  category_id?: string | number;
  categoryIds?: Array<string | number>;
  category_ids?: Array<string | number>;
  categories?: Array<string | number | Record<string, unknown>>;
  articleUrl?: string;
  urlTravel?: string;
};

const normalizePoint = (input: any, index: number): Point => {
  const raw = input && typeof input === 'object' ? input : {};

  const id =
    raw.id !== undefined && raw.id !== null && String(raw.id).trim().length > 0
      ? String(raw.id)
      : `idx-${index}`;

  const lat = typeof raw.lat === 'number' ? raw.lat : Number(raw.lat);
  const lng = typeof raw.lng === 'number' ? raw.lng : Number(raw.lng);

  const coord =
    typeof raw.coord === 'string' && raw.coord.trim()
      ? raw.coord.trim()
      : typeof raw.coords === 'string' && raw.coords.trim()
        ? raw.coords.trim()
        : Number.isFinite(lat) && Number.isFinite(lng)
          ? `${lat}, ${lng}`
          : '';

  const address =
    typeof raw.address === 'string' && raw.address.trim()
      ? raw.address.trim()
      : typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : '';

  return {
    id,
    coord,
    address,
    travelImageThumbUrl: raw.travelImageThumbUrl ?? raw.travel_image_thumb_url ?? raw.image ?? undefined,
    updated_at: raw.updated_at,
    categoryName: raw.categoryName ?? raw.category_name,
    category: raw.category,
    categoryId: raw.categoryId ?? raw.category_id,
    category_id: raw.category_id ?? raw.categoryId,
    categoryIds: raw.categoryIds ?? raw.category_ids,
    category_ids: raw.category_ids ?? raw.categoryIds,
    categories: raw.categories ?? raw.categoryIds ?? raw.category_ids,
    articleUrl: raw.articleUrl ?? raw.article_url,
    urlTravel: raw.urlTravel ?? raw.url_travel ?? raw.url,
  };
};

type TravelPropsType = {
  data?: Point[];
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

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

const DEFAULT_TRAVEL_POINT_COLOR = '#ff922b';
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

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

const hasMapPane = (map: any) => !!map && !!(map as any)._mapPane;

const MapClientSideComponent: React.FC<MapClientSideProps> = ({
                                                                travel = { data: [] },
                                                                coordinates = { latitude: 53.8828449, longitude: 27.7273595 },
                                                                highlightedPointRequest,
                                                              }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [L, setL] = useState<LeafletNS | null>(null);

  const rootRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${generateUniqueId()}`);
  const mapContainerIdRef = useRef<string>(`${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${generateUniqueId()}`);
  const markersRef = useRef<Map<string, any>>(new Map());
  const pendingHighlightRef = useRef<{ coordKey: string; requestKey: string } | null>(null);
  const siteCategoryDictionaryRef = useRef<CategoryDictionaryItem[]>([]);
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

  if (isWeb && typeof document !== 'undefined') {
    const existing = document.getElementById(mapContainerIdRef.current) as any;
    if (!mapRef.current && existing && existing._leaflet_id) {
      mapContainerIdRef.current = `${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${generateUniqueId()}`;
      mapInstanceKeyRef.current = `leaflet-map-${generateUniqueId()}`;
    }
  }

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;

    try {
      const allContainers = Array.from(
        document.querySelectorAll(`[id^="${LEAFLET_MAP_CONTAINER_ID_PREFIX}"]`)
      );
      allContainers.forEach((el: any) => {
        if (el.id === mapContainerIdRef.current) return;
        if (el && typeof el.isConnected === 'boolean' && el.isConnected) return;

        try {
          if (el._leaflet_map && typeof el._leaflet_map.remove === 'function') {
            el._leaflet_map.remove();
          }
        } catch {
          // noop
        }

        try {
          if (el._leaflet_map) {
            delete el._leaflet_map;
          }
        } catch {
          // noop
        }

        try {
          if (el._leaflet_id) {
            delete el._leaflet_id;
          }
        } catch {
          // noop
        }

        try {
          if (typeof el.innerHTML === 'string') el.innerHTML = '';
        } catch {
          // noop
        }
      });
    } catch (error) {
      console.warn('[Map] Failed to clean orphaned containers', error);
    }
  }, []);

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

  const buildGoogleMapsUrl = useCallback((coord: string) => {
    const cleaned = String(coord || '').replace(/;/g, ',').replace(/\s+/g, '');
    const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }, []);

  const buildOrganicMapsUrl = useCallback((coord: string) => {
    const cleaned = String(coord || '').replace(/;/g, ',').replace(/\s+/g, '');
    const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return `https://omaps.app/${lat},${lon}`;
  }, []);

  // Очистка Leaflet контейнера при размонтировании, чтобы избежать "Map container is already initialized"
  useEffect(() => {
    const rootEl = rootRef.current;
    const mapContainerId = mapContainerIdRef.current;
    return () => {
      try {
        if (mapRef.current && typeof mapRef.current.remove === 'function') {
          mapRef.current.remove();
        }
      } catch {
        // noop
      } finally {
        mapRef.current = null;
      }

      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          if (w.__metravelLeafletMap) {
            delete w.__metravelLeafletMap;
          }
        }
      } catch {
        // noop
      }

      // Доп. страховка: сбрасываем _leaflet_id только для контейнера этого компонента.
      try {
        const container = (rootEl as any)?.querySelector?.('.leaflet-container') as any;
        const idContainer = mapContainerId
          ? (document.getElementById(mapContainerId) as any)
          : null;
        const containers = [container, idContainer].filter(Boolean);

        containers.forEach((el: any) => {
          try {
            if (el._leaflet_map && typeof el._leaflet_map.remove === 'function') {
              el._leaflet_map.remove();
            }
          } catch {
            // noop
          }
          try {
            if (el._leaflet_map) delete el._leaflet_map;
          } catch {
            // noop
          }
          try {
            if (el._leaflet_id) delete el._leaflet_id;
          } catch {
            // noop
          }
          try {
            if (typeof el.innerHTML === 'string') el.innerHTML = '';
          } catch {
            // noop
          }
        });
      } catch {
        // noop
      }
    };
  }, []);

  // очень лёгкая инициализация: грузим libs на idle, как только компонент смонтирован
  useEffect(() => {
    if (!isWeb) return;

    setL(Leaflet);
  }, []);

  const travelData = useMemo(() => {
    const rawData = Array.isArray(travel?.data) ? travel.data : [];
    return rawData.map((p: any, idx: number) => normalizePoint(p, idx));
  }, [travel]);

  const initialCenter: [number, number] = [
    coordinates?.latitude ?? 53.8828449,
    coordinates?.longitude ?? 27.7273595,
  ];

  const leafletIcons = useLeafletIcons(L);

  const siteMarkerIcon = useMemo(() => {
    if (leafletIcons?.meTravel) return leafletIcons.meTravel;
    return null;
  }, [leafletIcons]);

  const renderPlaceholder = () => (
    <View style={styles.mapContainer}>
      <Text style={styles.placeholderText}>Загружаем карту…</Text>
    </View>
  );

  if (!isWeb) {
    return <Text style={{ padding: 20 }}>Карта доступна только в браузере</Text>;
  }

  if (!L || !siteMarkerIcon) {
    return renderPlaceholder();
  }


  const FitBoundsOnData: React.FC<{ data: Point[] }> = ({ data }) => {
    const map = useMap();

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

        const bounds = Leaflet.latLngBounds(coords);
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
    const map = useMap();
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
      <Marker
        key={`${point.id}`}
        position={latLng}
        icon={siteMarkerIcon}
        eventHandlers={{
          click: handleMarkerClick,
        }}
        ref={markerRef}
      >
        <PopupWithClose point={point} />
      </Marker>
    );
  };

  // Компонент для центрирования карты при открытии попапа
  const MapCenterOnPopup: React.FC = () => {
    const map = useMap();

    const handlePopupOpen = useCallback(
      (e: any) => {
        // Leaflet сам умеет autoPan, но на мобильных хочется, чтобы карточка была ближе к центру.
        // Делаем мягкий panBy по фактическому DOM-положению попапа относительно контейнера карты.
        if (!hasMapPane(map)) return;

        const run = () => {
          try {
            const popup = e?.popup;
            const popupEl: HTMLElement | null = popup?.getElement ? popup.getElement() : null;
            const mapEl: HTMLElement | null = map?.getContainer ? map.getContainer() : null;
            if (!popupEl || !mapEl) return;

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

            const padding = 16;
            const targetCenterX = mapRect.width / 2;
            // небольшое смещение вверх, чтобы “хвостик” попапа и маркер оставались видимыми
            const targetCenterY = mapRect.height * 0.45;

            const currentCenterX = popupRect.left + popupRect.width / 2;
            const currentCenterY = popupRect.top + popupRect.height / 2;

            let dx = targetCenterX - currentCenterX;
            let dy = targetCenterY - currentCenterY;

            // Если попап выходит за пределы, приоритет — вернуть его внутрь safe-area.
            const overflowLeft = padding - popupRect.left;
            const overflowRight = popupRect.right - (mapRect.width - padding);
            const overflowTop = padding - popupRect.top;
            const overflowBottom = popupRect.bottom - (mapRect.height - padding);

            if (overflowLeft > 0) dx = Math.max(dx, overflowLeft);
            if (overflowRight > 0) dx = Math.min(dx, -overflowRight);
            if (overflowTop > 0) dy = Math.max(dy, overflowTop);
            if (overflowBottom > 0) dy = Math.min(dy, -overflowBottom);

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

        // Ждём, пока Leaflet вставит попап в DOM и посчитает размеры
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => requestAnimationFrame(run));
        }
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
  const PopupWithClose: React.FC<{ point: Point }> = ({ point }) => {
    const map = useMap();
    const { isAuthenticated, authReady } = useAuth();
    const [isAddingPoint, setIsAddingPoint] = useState(false);

    const coord = String(point.coord ?? '').trim();
    const normalizedLatLng = useMemo(() => (coord ? getLatLng(coord) : null), [coord]);
    const categoryNames = useMemo(() => stripCountryFromCategoryNames(getPointCategoryNames(point), point.address), [point]);
    const categoryLabel = useMemo(() => categoryNames.join(', '), [categoryNames]);
    /* eslint-disable react-hooks/exhaustive-deps */
    const resolvedCategoryIdsFromNames = useMemo(() => {
      const map = createCategoryNameToIdsMap(siteCategoryDictionaryRef.current);
      return resolveCategoryIdsByNames(categoryNames, map);
    }, [categoryNames, categoryDictionaryVersion]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const handleClose = useCallback(() => {
      map.closePopup();
    }, [map]);

    const handleOpenArticle = useCallback(() => {
      const url = String(point.articleUrl || point.urlTravel || '').trim();
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [point.articleUrl, point.urlTravel]);

    const handleCopyCoord = useCallback(async () => {
      if (!coord) return;
      try {
        if ((navigator as any)?.clipboard?.writeText) {
          await (navigator as any).clipboard.writeText(coord);
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleOpenGoogleMaps = useCallback(() => {
      if (!coord) return;
      const url = buildGoogleMapsUrl(coord);
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleOpenOrganicMaps = useCallback(() => {
      if (!coord) return;
      const url = buildOrganicMapsUrl(coord);
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleShareTelegram = useCallback(() => {
      if (!coord) return;
      const mapUrl = buildGoogleMapsUrl(coord);
      const text = `Координаты: ${coord}`;
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
      try {
        if (typeof window !== 'undefined') {
          window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleAddPoint = useCallback(async () => {
      if (!authReady) return;
      if (!isAuthenticated) {
        void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' });
        return;
      }
      if (isAddingPoint) return;
      if (!normalizedLatLng) {
        void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' });
        return;
      }
      const [lat, lng] = normalizedLatLng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' });
        return;
      }

      const idsFromPoint = getPointCategoryIds(point);
      const combinedIds = Array.from(new Set([...idsFromPoint, ...resolvedCategoryIdsFromNames]));
      const filteredIds = stripCountryFromCategoryIds(
        combinedIds,
        point.address,
        categoryIdToName
      );
      const categoryNameString = categoryLabel || undefined;
      const payload: Record<string, unknown> = {
        name: point.address || 'Точка маршрута',
        address: point.address,
        latitude: lat,
        longitude: lng,
        color: DEFAULT_TRAVEL_POINT_COLOR,
        status: DEFAULT_TRAVEL_POINT_STATUS,
        category: categoryNameString,
        categoryName: categoryNameString,
      };

      const photoCandidate =
        (point as any)?.travelImageThumbUrl ??
        (point as any)?.travel_image_thumb_url ??
        (point as any)?.image;
      if (typeof photoCandidate === 'string' && photoCandidate.trim()) {
        payload.photo = photoCandidate.trim();
      }
      if (filteredIds.length > 0) {
        payload.categoryIds = filteredIds;
      }
      const tags: Record<string, unknown> = {};
      if (point.urlTravel) {
        tags.travelUrl = point.urlTravel;
      }
      if (point.articleUrl) {
        tags.articleUrl = point.articleUrl;
      }
      if (Object.keys(tags).length > 0) {
        payload.tags = tags;
      }

      setIsAddingPoint(true);
      try {
        await userPointsApi.createPoint(payload);
        void showToast({
          type: 'success',
          text1: 'Точка добавлена в «Мои точки»',
          position: 'bottom',
        });
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
        handleClose();
      } catch {
        void showToast({
          type: 'error',
          text1: 'Не удалось сохранить точку',
          position: 'bottom',
        });
      } finally {
        setIsAddingPoint(false);
      }
    }, [
      authReady,
      categoryLabel,
      handleClose,
      isAddingPoint,
      isAuthenticated,
      normalizedLatLng,
      point,
      resolvedCategoryIdsFromNames,
    ]);

    return (
      <Popup
        autoPan
        keepInView
        autoPanPadding={[16, 16] as any}
        autoPanPaddingTopLeft={[16, 120] as any}
        autoPanPaddingBottomRight={[16, 280] as any}
        closeButton
      >
        <PlacePopupCard
          title={point.address || ''}
          imageUrl={point.travelImageThumbUrl}
          categoryLabel={categoryLabel}
          coord={coord}
          onOpenArticle={handleOpenArticle}
          onCopyCoord={handleCopyCoord}
          onShareTelegram={handleShareTelegram}
          onOpenGoogleMaps={handleOpenGoogleMaps}
          onOpenOrganicMaps={handleOpenOrganicMaps}
          onAddPoint={handleAddPoint}
          addDisabled={!authReady || !isAuthenticated || !normalizedLatLng || isAddingPoint}
          isAdding={isAddingPoint}
        />
      </Popup>
    );
  };

  return (
    <View
      style={styles.mapContainer}
      ref={rootRef}
      {...({ className: 'metravel-travel-map' } as any)}
    >
      <style>
        {`
        .metravel-travel-map .leaflet-popup-content-wrapper,
        .metravel-travel-map .leaflet-popup-tip {
          background: ${(colors as any).surface} !important;
          opacity: 1 !important;
        }
        .metravel-travel-map .leaflet-popup-content-wrapper {
          color: ${(colors as any).text} !important;
          border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          border: 1px solid ${(colors as any).border} !important;
          max-height: 280px !important;
          overflow: hidden !important;
        }
        .metravel-travel-map .leaflet-popup-content {
          margin: ${DESIGN_TOKENS.spacing.md}px !important;
          color: ${(colors as any).text} !important;
          max-height: 260px !important;
          overflow-y: auto !important;
          width: 320px !important;
        }
        .metravel-travel-map .leaflet-popup-close-button {
          display: block !important;
          width: 28px !important;
          height: 28px !important;
          line-height: 26px !important;
          text-align: center !important;
          border-radius: 999px !important;
          border: 1px solid ${(colors as any).border} !important;
          background: ${(colors as any).surface} !important;
          top: 8px !important;
          right: 8px !important;
          z-index: 2 !important;
          color: ${(colors as any).textMuted} !important;
          cursor: pointer !important;
          font-size: 18px !important;
          transition: all 0.2s !important;
        }
        .metravel-travel-map .leaflet-popup-close-button:hover {
          color: ${(colors as any).text} !important;
          background: ${(colors as any).backgroundSecondary} !important;
          transform: scale(1.05) !important;
        }
        @media (max-width: 640px) {
          .metravel-travel-map .leaflet-popup {
            max-width: 92vw !important;
          }
          .metravel-travel-map .leaflet-popup-content-wrapper {
            max-height: 40vh !important;
          }
          .metravel-travel-map .leaflet-popup-content {
            width: min(92vw, 320px) !important;
            max-height: calc(40vh - 16px) !important;
            margin: ${DESIGN_TOKENS.spacing.xs}px !important;
          }
        }
        @media (max-width: 420px) {
          .metravel-travel-map .leaflet-popup-content-wrapper {
            max-height: 36vh !important;
          }
          .metravel-travel-map .leaflet-popup-content {
            max-height: calc(36vh - 12px) !important;
          }
        }
        `}
      </style>
      <MapContainer
        center={initialCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        id={mapContainerIdRef.current}
        key={mapInstanceKeyRef.current}
        // чутка экономим на анимациях
        preferCanvas
        whenCreated={(map: any) => {
          mapRef.current = map;
          try {
            const el = map?.getContainer?.() as any;
            if (el) {
              el._leaflet_map = map;
            }
          } catch {
            // noop
          }
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CartoDB"
          crossOrigin="anonymous"
        />
        <FitBoundsOnData data={travelData} />
        <MapCenterOnPopup />
        {travelData.map((point) => {
          const latLng = getLatLng(point.coord);
          if (!latLng) return null;
          return (
            <MarkerWithPopup key={`${point.id}`} point={point} latLng={latLng} />
          );
        })}
      </MapContainer>
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
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});
