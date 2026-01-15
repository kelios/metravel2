// app/Map.tsx (бывш. MapClientSideComponent) — ультралёгкая web-карта
import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Feather from '@expo/vector-icons/Feather';

import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';

export type Point = {
  id: string;
  coord: string;
  address: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  categoryName?: string;
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
}

// Используем UnifiedTravelCard для попапов
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';

const isWeb = Platform.OS === 'web';
const getLatLng = (latlng: string): [number, number] | null => {
  if (!latlng) return null;
  const [lat, lng] = latlng.split(',').map(Number);
  return isNaN(lat) || isNaN(lng) ? null : [lat, lng];
};

type LeafletNS = any;
type RL = typeof import('react-leaflet');

const hasMapPane = (map: any) => !!map && !!(map as any)._mapPane;

const MapClientSideComponent: React.FC<MapClientSideProps> = ({
                                                                travel = { data: [] },
                                                                coordinates = { latitude: 53.8828449, longitude: 27.7273595 },
                                                              }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [L, setL] = useState<LeafletNS | null>(null);
  const [rl, setRl] = useState<RL | null>(null);

  const rootRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${Math.random().toString(36).slice(2)}`);
  const mapContainerIdRef = useRef<string>(`metravel-leaflet-map-${Math.random().toString(36).slice(2)}`);

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
        if (container?._leaflet_id) {
          delete container._leaflet_id;
        }
        if (idContainer?._leaflet_id) {
          delete idContainer._leaflet_id;
        }
      } catch {
        // noop
      }
    };
  }, []);

  // React/Leaflet: если контейнер "завис" с _leaflet_id, очистим его до инициализации карты.
  useLayoutEffect(() => {
    if (!isWeb) return;
    const containerId = mapContainerIdRef.current;
    if (!containerId || typeof document === 'undefined') return;

    const container = document.getElementById(containerId) as any;
    if (!container || !container._leaflet_id || mapRef.current) return;

    try {
      if (container._leaflet_map && typeof container._leaflet_map.remove === 'function') {
        container._leaflet_map.remove();
      }
    } catch {
      // noop
    } finally {
      try {
        delete container._leaflet_id;
      } catch {
        // noop
      }
    }
  }, []);

  // очень лёгкая инициализация: грузим libs на idle, как только компонент смонтирован
  useEffect(() => {
    if (!isWeb) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { L, rl: rlMod } = await ensureLeafletAndReactLeaflet();
        if (!cancelled) {
          setL(L);
          setRl(rlMod);
        }
      } catch (error) {
        console.warn('Leaflet web load failed', error);
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(load, { timeout: 2000 });
    } else {
      const t = setTimeout(load, 1200);
      return () => clearTimeout(t);
    }

    return () => { cancelled = true; };
  }, []);

  const travelData = useMemo(() => {
    const rawData = Array.isArray(travel?.data) ? travel.data : [];
    return rawData.map((p: any, idx: number) => normalizePoint(p, idx));
  }, [travel]);

  const initialCenter: [number, number] = [
    coordinates?.latitude ?? 53.8828449,
    coordinates?.longitude ?? 27.7273595,
  ];

  // ✅ ИСПРАВЛЕНИЕ: Используем стандартный оранжевый маркер (как в MapPage/Map.web.tsx)
  const meTravelIcon = useMemo(() => {
    if (!L) return null;
    return new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
      crossOrigin: true,
    });
  }, [L]);

  const renderPlaceholder = () => (
    <View style={styles.mapContainer}>
      <Text style={styles.placeholderText}>Загружаем карту…</Text>
    </View>
  );

  if (!isWeb) {
    return <Text style={{ padding: 20 }}>Карта доступна только в браузере</Text>;
  }

  if (!L || !rl || !meTravelIcon) {
    return renderPlaceholder();
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap } = rl;

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
    const map = useMap();

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
        icon={meTravelIcon}
        eventHandlers={{
          click: handleMarkerClick,
        }}
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

    const coord = String(point.coord ?? '').trim();

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

    return (
      <Popup
        autoPan
        keepInView
        autoPanPadding={[16, 16] as any}
        autoPanPaddingTopLeft={[16, 96] as any}
        autoPanPaddingBottomRight={[16, 120] as any}
        closeButton
      >
        <UnifiedTravelCard
          title={point.address || ''}
          imageUrl={point.travelImageThumbUrl}
          metaText={point.categoryName}
          onPress={handleClose}
          onMediaPress={handleOpenArticle}
          imageHeight={180}
          width={300}
          contentSlot={
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: (colors as any).text ?? undefined }} numberOfLines={1}>
                {point.address || ''}
              </Text>
              {!!coord && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: (colors as any).textMuted ?? undefined,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
                    }}
                    numberOfLines={1}
                  >
                    {coord}
                  </Text>
                  <Pressable
                    accessibilityLabel="Скопировать координаты"
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      void handleCopyCoord();
                    }}
                    {...({ 'data-card-action': 'true', title: 'Скопировать координаты' } as any)}
                  >
                    <View {...({ title: 'Скопировать координаты', 'aria-label': 'Скопировать координаты' } as any)}>
                      <Feather name="clipboard" size={16} color={(colors as any).textMuted ?? undefined} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Поделиться в Telegram"
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      handleShareTelegram();
                    }}
                    {...({ 'data-card-action': 'true', title: 'Поделиться в Telegram' } as any)}
                  >
                    <View {...({ title: 'Поделиться в Telegram', 'aria-label': 'Поделиться в Telegram' } as any)}>
                      <Feather name="send" size={16} color={(colors as any).textMuted ?? undefined} />
                    </View>
                  </Pressable>
                </View>
              )}
              {(!!point.categoryName || !!coord) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {!!point.categoryName && (
                    <Text style={{ fontSize: 12, color: (colors as any).textMuted ?? undefined }} numberOfLines={1}>
                      {point.categoryName}
                    </Text>
                  )}

                  {!!coord && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <Pressable
                        accessibilityLabel="Открыть в Google Maps"
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          handleOpenGoogleMaps();
                        }}
                        {...({ 'data-card-action': 'true', title: 'Открыть в Google Maps' } as any)}
                      >
                        <View {...({ title: 'Открыть в Google Maps', 'aria-label': 'Открыть в Google Maps' } as any)}>
                          <Feather name="external-link" size={16} color={(colors as any).textMuted ?? undefined} />
                        </View>
                      </Pressable>

                      <Pressable
                        accessibilityLabel="Открыть в Organic Maps"
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          handleOpenOrganicMaps();
                        }}
                        {...({ 'data-card-action': 'true', title: 'Открыть в Organic Maps' } as any)}
                      >
                        <View {...({ title: 'Открыть в Organic Maps', 'aria-label': 'Открыть в Organic Maps' } as any)}>
                          <Feather name="navigation" size={16} color={(colors as any).textMuted ?? undefined} />
                        </View>
                      </Pressable>

                      {!!String(point.articleUrl || point.urlTravel || '').trim() && (
                        <Pressable
                          accessibilityLabel="Открыть статью"
                          onPress={(e) => {
                            (e as any)?.stopPropagation?.();
                            handleOpenArticle();
                          }}
                          {...({ 'data-card-action': 'true', title: 'Открыть статью' } as any)}
                        >
                          <View {...({ title: 'Открыть статью', 'aria-label': 'Открыть статью' } as any)}>
                            <Feather name="book-open" size={16} color={(colors as any).textMuted ?? undefined} />
                          </View>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          }
          mediaProps={{
            blurBackground: true,
            blurRadius: 16,
            loading: 'lazy',
            priority: 'low',
          }}
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
          border-radius: ${DESIGN_TOKENS.radii.md}px !important;
          box-shadow: ${DESIGN_TOKENS.shadows.modal} !important;
          border: 1px solid ${(colors as any).border} !important;
        }
        .metravel-travel-map .leaflet-popup-content {
          margin: ${DESIGN_TOKENS.spacing.md}px !important;
          color: ${(colors as any).text} !important;
        }
        .metravel-travel-map .leaflet-popup-close-button {
          display: block !important;
          color: ${(colors as any).textMuted} !important;
        }
        .metravel-travel-map .leaflet-popup-close-button:hover {
          color: ${(colors as any).text} !important;
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
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap © CartoDB"
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
