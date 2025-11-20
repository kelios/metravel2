// app/Map.tsx (бывш. MapClientSideComponent) — ультралёгкая web-карта
import React, { lazy, Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useLazyMap } from '@/hooks/useLazyMap';

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

const ensureLeafletCSS = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-leaflet-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.setAttribute('data-leaflet-css', '1');
  document.head.appendChild(link);
};

type LeafletNS = typeof import('leaflet');
type RL = typeof import('react-leaflet');

const MapClientSideComponent: React.FC<MapClientSideProps> = ({
                                                                travel = { data: [] },
                                                                coordinates = { latitude: 53.8828449, longitude: 27.7273595 },
                                                              }) => {
  // карта только в браузере
  if (!isWeb) {
    return <Text style={{ padding: 20 }}>Карта доступна только в браузере</Text>;
  }

  const [L, setL] = useState<LeafletNS | null>(null);
  const [rl, setRl] = useState<RL | null>(null);

  // ✅ УЛУЧШЕНИЕ: Используем useLazyMap для оптимизации загрузки
  const { shouldLoad, setElementRef } = useLazyMap({
    rootMargin: '200px',
    threshold: 0.1,
    enabled: isWeb,
  });

  // очень лёгкая инициализация: грузим libs на idle, только когда нужно
  useEffect(() => {
    if (!shouldLoad) return;
    
    let cancelled = false;

    const load = async () => {
      try {
        ensureLeafletCSS();
        const [leafletMod, rlMod] = await Promise.all([
          import('leaflet'),
          import('react-leaflet'),
        ]);
        if (!cancelled) {
          setL(leafletMod);
          setRl(rlMod);
        }
      } catch {
        // проглатываем — покажем текст-заглушку
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(load, { timeout: 2000 });
    } else {
      const t = setTimeout(load, 1200);
      return () => clearTimeout(t);
    }

    return () => { cancelled = true; };
  }, [shouldLoad]);

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

  // Пока ещё не загрузили библиотеки — лёгкий placeholder (не блокирует main thread)
  if (!L || !rl || !meTravelIcon) {
    return <View style={[styles.mapContainer, { minHeight: 300 }]} />;
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap } = rl;

  const FitBoundsOnData: React.FC<{ data: Point[] }> = ({ data }) => {
    const map = useMap();
    useEffect(() => {
      const coords = data.map((p) => getLatLng(p.coord)).filter(Boolean) as [number, number][];
      if (!coords.length) return;
      const bounds = L.latLngBounds(coords);
      if (bounds.isValid()) {
        // малый padding, чтобы не было резких анимаций
        map.fitBounds(bounds, { padding: [32, 32] });
      }
    }, [map, data]);
    return null;
  };

  // Компонент для центрирования карты при открытии попапа
  const MapCenterOnPopup: React.FC<{ point: Point }> = ({ point }) => {
    const map = useMap();

    const handlePopupOpen = useCallback(() => {
      const coords = getLatLng(point.coord);
      if (coords) {
        // Центрируем карту с небольшим сдвигом вверх чтобы попап был виден полностью
        const [lat, lng] = coords;
        map.setView([lat - 0.005, lng], map.getZoom(), {
          animate: true,
          duration: 0.5
        });
      }
    }, [map, point.coord]);

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
      <Popup>
        <Suspense fallback={<Text>Загрузка…</Text>}>
          <PopupContent travel={point} onClose={handleClose} />
        </Suspense>
      </Popup>
    );
  };

  // Если карта еще не должна загружаться, показываем placeholder
  if (!shouldLoad) {
    return (
      <View 
        style={styles.mapContainer}
        ref={setElementRef as any}
      >
        <Text style={styles.placeholderText}>Карта загрузится при прокрутке…</Text>
      </View>
    );
  }

  // Если библиотеки еще не загружены, показываем загрузку
  if (!L || !rl) {
    return (
      <View style={styles.mapContainer}>
        <Text style={styles.placeholderText}>Загрузка карты…</Text>
      </View>
    );
  }

  return (
    <View 
      style={styles.mapContainer}
      ref={setElementRef as any}
    >
      <MapContainer
        center={initialCenter}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        // чутка экономим на анимациях
        preferCanvas
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBoundsOnData data={travelData} />
        {travelData.map((point) => {
          const latLng = getLatLng(point.coord);
          if (!latLng) return null;
          return (
            <Marker key={`${point.id}`} position={latLng} icon={meTravelIcon}>
              <MapCenterOnPopup point={point} />
              <PopupWithClose point={point} />
            </Marker>
          );
        })}
      </MapContainer>
    </View>
  );
};

export default React.memo(MapClientSideComponent);

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});