// app/Map.tsx (бывш. MapClientSideComponent) — ультралёгкая web-карта
import React, { lazy, Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';

export type Point = {
  id: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
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

// Ленивая подгрузка содержимого попапа (не тянем в начальный чанк карты)
const PopupContent = lazy(() => import('@/components/MapPage/PopupContentComponent'));

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

  // Очистка Leaflet контейнера при размонтировании, чтобы избежать "Map container is already initialized"
  useEffect(() => {
    const rootEl = rootRef.current;
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
        if (container?._leaflet_id) {
          delete container._leaflet_id;
        }
      } catch {
        // noop
      }
    };
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

  const travelData = useMemo(() => travel.data || [], [travel.data]);
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

    const handleClose = useCallback(() => {
      map.closePopup();
    }, [map]);

    return (
      <Popup
        autoPan
        keepInView
        autoPanPadding={[16, 16] as any}
        autoPanPaddingTopLeft={[16, 96] as any}
        autoPanPaddingBottomRight={[16, 120] as any}
        closeButton={false}
      >
        <Suspense fallback={<Text>Загрузка…</Text>}>
          <PopupContent travel={point} onClose={handleClose} />
        </Suspense>
      </Popup>
    );
  };

  return (
    <View 
      style={styles.mapContainer}
      ref={rootRef}
    >
      <MapContainer
        center={initialCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
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
