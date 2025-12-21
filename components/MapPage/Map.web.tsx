// components/MapPage/Map.web.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Location from 'expo-location';
import 'leaflet/dist/leaflet.css';
type ReactLeafletNS = typeof import('react-leaflet');
// CSS загружается через CDN ниже в коде
import RoutingMachine from '@/components/MapPage/RoutingMachine';
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';
// MapLegend is currently unused in the web map

type Point = {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

type TransportMode = 'car' | 'bike' | 'foot';
type MapMode = 'radius' | 'route';

interface Props {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  routePoints: [number, number][];
  setRoutePoints: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  radius?: string; // Радиус поиска в км
}

const strToLatLng = (s: string): [number, number] | null => {
  const [lat, lng] = s.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
};

// ✅ ОПТИМИЗАЦИЯ: Мемоизированный компонент маркеров для предотвращения лишних перерисовок
interface TravelMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>; // Передаем компонент попапа как проп
}

const TravelMarkers: React.FC<TravelMarkersProps> = ({ points, icon, Marker, Popup, PopupContent }) => {
  return (
    <>
      {points.map((point, index) => {
        const coords = strToLatLng(point.coord);
        if (!coords || !point.coord) {
          return null;
        }
        
        const markerKey = point.id 
          ? `travel-${point.id}` 
          : `travel-${point.coord.replace(/,/g, '-')}-${index}`;
        
        return (
          <Marker
            key={markerKey}
            position={[coords[1], coords[0]]}
            icon={icon}
          >
            <Popup>
              <PopupContent point={point} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// Мемоизация с кастомным компаратором - перерисовываем только при изменении ID точек
// ✅ ИСПРАВЛЕНИЕ: Улучшенное сравнение для предотвращения лишних перерисовок
const TravelMarkersMemo = React.memo(TravelMarkers, (prev, next) => {
  // Сравниваем количество точек
  if (prev.points.length !== next.points.length) return false;
  
  // Сравниваем ссылки на иконки и компоненты (они должны быть стабильными)
  if (prev.icon !== next.icon || prev.Marker !== next.Marker || prev.Popup !== next.Popup || prev.PopupContent !== next.PopupContent) {
    return false;
  }
  
  // ✅ ИСПРАВЛЕНИЕ: Более надежное сравнение точек с проверкой всех ключевых полей
  return prev.points.every((p, i) => {
    const nextPoint = next.points[i];
    if (!nextPoint) return false;
    // Сравниваем ID, координаты и адрес для надежности
    return (
      p.id === nextPoint.id &&
      p.coord === nextPoint.coord &&
      p.address === nextPoint.address
    );
  });
});

const MapPageComponent: React.FC<Props> = ({
                                             travel = { data: [] },
                                             coordinates,
                                             routePoints,
                                             setRoutePoints,
                                             onMapClick,
                                             mode,
                                             transportMode,
                                             setRouteDistance,
                                             setFullRouteCoords,
                                             radius,
                                           }) => {
  const [L, setL] = useState<any>(null);
  const [rl, setRl] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [errors, setErrors] = useState({
    location: false,
    loadingModules: false,
    routing: false,
  });
  const [loading, setLoading] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [disableFitBounds, setDisableFitBounds] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  const travelData = useMemo(
    () => (Array.isArray(travel?.data) ? travel.data : []),
    [travel?.data]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    const handler = (event: MediaQueryListEvent) => setIsMobileScreen(event.matches);
    if (media.addEventListener) {
      media.addEventListener('change', handler);
    } else {
      // @ts-ignore
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler);
      } else {
        // @ts-ignore
        media.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

    const ensureLeafletCSS = () => {
      const href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    };

    const ensureLeaflet = async (): Promise<any> => {
      const w = window as any;
      if (w.L) return w.L;

      ensureLeafletCSS();

      if (!(ensureLeaflet as any)._loader) {
        (ensureLeaflet as any)._loader = new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (err) => {
            (ensureLeaflet as any)._loader = null;
            reject(err);
          };
          document.body.appendChild(script);
        });
      }

      await (ensureLeaflet as any)._loader;
      return w.L;
    };

    const load = async () => {
      try {
        const L = await ensureLeaflet();
        const rlMod = await import('react-leaflet');
        if (!cancelled) {
          setL(L);
          setRl(rlMod);
        }
      } catch {
        if (!cancelled) {
          setErrors((prev) => ({ ...prev, loadingModules: true }));
        }
      }
    };

    if (isTestEnv) {
      load();
    } else if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(load, { timeout: 2000 });
    } else {
      const t = setTimeout(load, 1200);
      return () => clearTimeout(t);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const ORS_API_KEY = process.env.EXPO_PUBLIC_ROUTE_SERVICE;

  const RoutingMachineWithMapInner: React.FC<any> = (props) => {
    const useMap = (rl as any).useMap;
    const map = useMap();
    return <RoutingMachine map={map} {...props} />;
  };

  const customIcons = useMemo(() => {
    // Защита от отсутствия Leaflet в тестовой/серверной среде
    if (!L || typeof (L as any).Icon !== 'function') {
      return {
        meTravel: undefined,
        userLocation: undefined,
        start: undefined,
        end: undefined,
      } as any;
    }

    // Цвета сайта
    // primary: '#ff9f5a' (оранжевый) - для путешествий
    // success: '#25a562' (зеленый) - для старта
    // danger: '#d94b4b' (красный) - для финиша
    // info: '#2b6cb0' (синий) - для местоположения
    
    // ✅ ИСПРАВЛЕНИЕ: Оранжевый маркер для путешествий (стандартный оранжевый)
    const orangeMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
      // ✅ Убеждаемся что иконка всегда загружается
      crossOrigin: true,
    });
    
    // Зеленый маркер для старта (success цвет)
    const greenMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [30, 41],
      iconAnchor: [15, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
    
    // Красный маркер для финиша (danger цвет)
    const redMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [30, 41],
      iconAnchor: [15, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
    
    // Синий маркер для местоположения (info цвет)
    const blueMarkerIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
    
    return {
      meTravel: orangeMarkerIcon,
      userLocation: blueMarkerIcon,
      start: greenMarkerIcon,
      end: redMarkerIcon,
    };
  }, [L]);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        setLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new globalThis.Error();
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        setErrors((prev) => ({ ...prev, location: true }));
      } finally {
        setLoading(false);
      }
    };
    requestLocation();
  }, []);

  const handleMapClick = useCallback(
      (e: any) => {
        if (mode !== 'route' || routePoints.length >= 2) return;
        const newPoint: [number, number] = [e.latlng.lng, e.latlng.lat];
        setRoutePoints([...routePoints, newPoint]);
        setDisableFitBounds(true);
        onMapClick(e.latlng.lng, e.latlng.lat);
      },
      [mode, routePoints, setRoutePoints, onMapClick]
  );

  // Вычисляем радиус в метрах для отображения круга (должен быть до условных возвратов)
  const radiusInMeters = useMemo(() => {
    if (mode !== 'radius') return null;
    // Используем переданный радиус или значение по умолчанию 60 км
    const radiusValue = radius || '60';
    const radiusKm = parseInt(radiusValue, 10);
    if (isNaN(radiusKm) || radiusKm <= 0) return 60000; // По умолчанию 60 км
    return radiusKm * 1000; // Конвертируем км в метры
  }, [mode, radius]);

  // Сохраняем ссылку на карту для кнопки "Мое местоположение" (должен быть до условных возвратов)
  const mapRef = useRef<any>(null);

  // ✅ ИСПРАВЛЕНИЕ: Используем useRef для отслеживания инициализации
  // Должны быть объявлены ДО условных возвратов, чтобы соблюдать правила хуков
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<MapMode | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  // Функция для центрирования на местоположении пользователя (должна быть до условных возвратов)
  const centerOnUserLocation = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.setView([userLocation.latitude, userLocation.longitude], 13, { animate: true });
  }, [userLocation]);

  // Тестовый экспорт: предоставляем обработчик клика по маркерам старта/финиша,
  // который предотвращает дальнейшую обработку события (и, соответственно, зум).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode === 'route' && routePoints.length >= 1) {
      (globalThis as any).lastMarkerClickHandler = (e: any) => {
        e?.originalEvent?.stopPropagation?.();
      };
    }
  }, [mode, routePoints.length]);

  if (loading) return <Loader message="Loading map..." />;

  if (!L || !rl) {
    return <Loader message={errors.loadingModules ? 'Loading map modules failed' : 'Loading map...'} />;
  }

  const { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } = rl as ReactLeafletNS;

  // Компонент для управления закрытием попапа (внутри MapContainer)
  const PopupWithClose: React.FC<{ point: Point }> = ({ point }) => {
    const map = useMap();

    const handleClose = useCallback(() => {
      map.closePopup();
    }, [map]);

    return <PopupContentComponent travel={point} onClose={handleClose} />;
  };

  const MapLogic: React.FC<{
    travelData: Point[];
    userLocation: Coordinates | null;
    mode: MapMode;
    coordinates: Coordinates;
    disableFitBounds: boolean;
  }> = ({ travelData, userLocation, mode, coordinates, disableFitBounds }) => {
    const map = useMap();
    useMapEvents({ click: handleMapClick });
    const [hasCenteredOnData, setHasCenteredOnData] = useState(false);
    const fitBoundsPoints = useMemo<[number, number][]>(() => {
      const points: [number, number][] = [];

      if (travelData.length > 0) {
        const travelPoints = travelData
          .map((p) => strToLatLng(p.coord))
          .filter(Boolean) as [number, number][];
        points.push(...travelPoints);
      }

      if (points.length === 0 && userLocation) {
        points.push([userLocation.longitude, userLocation.latitude]);
      }

      return points;
    }, [travelData, userLocation]);

    // Сохраняем ссылку на карту
    useEffect(() => {
      mapRef.current = map;
    }, [map]);

    // Сохраняем текущую позицию карты при изменении (только в режиме route)
    useEffect(() => {
      if (!map || mode !== 'route') return;
      
      const saveView = () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        savedMapViewRef.current = {
          center: [center.lat, center.lng],
          zoom,
        };
      };
      
      // Сохраняем позицию при изменении зума или перемещении
      map.on('moveend', saveView);
      map.on('zoomend', saveView);
      
      return () => {
        map.off('moveend', saveView);
        map.off('zoomend', saveView);
      };
    }, [map, mode]);

    // Центрирование на местоположение пользователя при первой загрузке
    useEffect(() => {
      if (!map) return;
      
      // ✅ ИСПРАВЛЕНИЕ: В режиме route НИКОГДА не центрируем автоматически
      // Пользователь сам выбирает точки на карте, карта должна оставаться на текущей позиции
      if (mode === 'route') {
        // Только при первой инициализации используем coordinates
        if (!hasInitializedRef.current && coordinates.latitude && coordinates.longitude) {
          map.setView([coordinates.latitude, coordinates.longitude], 13, { animate: false });
          hasInitializedRef.current = true;
        }
        // После инициализации НЕ трогаем карту - она остается на текущей позиции
        lastModeRef.current = mode;
        return;
      }
      
      // Если переключились с route на radius, сбрасываем флаг инициализации
      if (lastModeRef.current === 'route' && mode === 'radius') {
        hasInitializedRef.current = false;
      }
      
      // Только для режима radius делаем центрирование при первой загрузке
      if (!hasInitializedRef.current) {
        if (userLocation) {
          map.setView([userLocation.latitude, userLocation.longitude], 11, { animate: false });
          hasInitializedRef.current = true;
        } else if (coordinates.latitude && coordinates.longitude) {
          map.setView([coordinates.latitude, coordinates.longitude], 11, { animate: false });
          hasInitializedRef.current = true;
        }
      }
      
      lastModeRef.current = mode;
    }, [map, mode, coordinates, userLocation]);

    // Автоматическая подгонка границ при изменении данных (но только если не отключено)
    const shouldFitBounds = !disableFitBounds && mode !== 'route';

    useEffect(() => {
      if (!map || !shouldFitBounds) return;

      // Защита от отсутствия Leaflet в тестовой/серверной среде
      if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') {
        return;
      }

      if (fitBoundsPoints.length > 0) {
        const bounds = L.latLngBounds(
          fitBoundsPoints.map(([lng, lat]) => L.latLng(lat, lng))
        );
        map.fitBounds(bounds.pad(0.2), { animate: !hasCenteredOnData });
        setHasCenteredOnData(true);
      }
    }, [fitBoundsPoints, hasCenteredOnData, map, shouldFitBounds]);

    return null;
  };

  if (loading) return <Loader message="Loading map..." />;

  if (!L || !rl) {
    return <Loader message={errors.loadingModules ? 'Loading map modules failed' : 'Loading map...'} />;
  }

  return (
      <View style={styles.wrapper}>
        {/* Кнопка "Мое местоположение" */}
        {userLocation && Platform.OS === 'web' && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
          }}>
            <button
              onClick={centerOnUserLocation}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '2px solid rgba(0,0,0,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.2s ease',
                color: '#2b6cb0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f7ff';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Мое местоположение"
              aria-label="Вернуться к моему местоположению"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}
        {isMobileScreen && mode === 'route' && routePoints.length < 2 && (
          <div style={styles.mobileRouteHint}>
            <div style={styles.mobileRouteHintIcon}>➜</div>
            <div>
              <div style={styles.mobileRouteHintTitle}>
                Укажи старт и финиш
              </div>
              <div style={styles.mobileRouteHintText}>
                Нажми по карте: сначала старт, затем финиш. Карта не будет масштабироваться автоматически.
              </div>
            </div>
          </div>
        )}
        
        <MapContainer
            center={
              // ✅ ИСПРАВЛЕНИЕ: В режиме route всегда используем только coordinates
              // Это предотвращает центрирование на пользователя при клике и переключении вкладок
              mode === 'route' 
                ? [coordinates.latitude, coordinates.longitude]
                : (userLocation ? [userLocation.latitude, userLocation.longitude] : [coordinates.latitude, coordinates.longitude])
            }
            zoom={mode === 'route' ? 13 : (userLocation ? 11 : 13)}
            // NOTE: react-leaflet expects a plain DOM style object.
            // Passing a React Native StyleSheet value here can result in an invalid style
            // (e.g. a numeric StyleSheet id), which makes the map container collapse.
            // Also, relying on `flex: 1` for DOM nodes is fragile with React Native Web parents.
            // Use absolute positioning to guarantee the map fills the wrapper.
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as any}
            zoomAnimation={false}
            markerZoomAnimation={false}
            whenReady={(e: any) => {
              const map = e?.target;
              if (map) {
                mapRef.current = map;
                try {
                  map.invalidateSize?.(true);
                } catch {
                  // noop
                }
                requestAnimationFrame(() => {
                  try {
                    map.invalidateSize?.(true);
                  } catch {
                    // noop
                  }
                });
                setTimeout(() => {
                  try {
                    map.invalidateSize?.(true);
                  } catch {
                    // noop
                  }
                }, 300);
              }
            }}
        >
          <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <MapLogic
            travelData={travelData}
            userLocation={userLocation}
            mode={mode}
            coordinates={coordinates}
            disableFitBounds={disableFitBounds}
          />

          {/* Круг радиуса поиска */}
          {mode === 'radius' && radiusInMeters && (
              <Circle
                  center={[coordinates.latitude, coordinates.longitude]}
                  radius={radiusInMeters}
                  pathOptions={{
                      color: '#ff9800',
                      fillColor: '#ff9800',
                      fillOpacity: 0.2,
                      weight: 2,
                  }}
              />
          )}

          {routePoints.length >= 1 && customIcons?.start && (
              <Marker 
                position={[routePoints[0][1], routePoints[0][0]]} 
                icon={customIcons.start}
                eventHandlers={{
                  // ✅ ИСПРАВЛЕНИЕ: Отключаем зум при клике на маркер старт
                  click: (e: any) => {
                    e.originalEvent?.stopPropagation();
                  }
                }}
              >
                <Popup>Start</Popup>
              </Marker>
          )}

          {routePoints.length === 2 && customIcons?.end && (
              <Marker 
                position={[routePoints[1][1], routePoints[1][0]]} 
                icon={customIcons.end}
                eventHandlers={{
                  // ✅ ИСПРАВЛЕНИЕ: Отключаем зум при клике на маркер финиш
                  click: (e: any) => {
                    e.originalEvent?.stopPropagation();
                  }
                }}
              >
                <Popup>End</Popup>
              </Marker>
          )}

          {mode === 'route' && routePoints.length >= 2 && rl && (
              <RoutingMachineWithMapInner
                  routePoints={routePoints}
                  transportMode={transportMode}
                  setRoutingLoading={setRoutingLoading}
                  setErrors={setErrors}
                  setRouteDistance={setRouteDistance}
                  setFullRouteCoords={setFullRouteCoords}
                  ORS_API_KEY={ORS_API_KEY}
              />
          )}

          {userLocation && customIcons?.userLocation && (
              <Marker
                  position={[userLocation.latitude, userLocation.longitude]}
                  icon={customIcons.userLocation}
              >
                <Popup>Your location</Popup>
              </Marker>
          )}

          {/* ✅ ИСПРАВЛЕНИЕ: Маркеры путешествий - всегда оранжевые стандартные */}
          {customIcons?.meTravel && travelData.length > 0 && (
            <TravelMarkersMemo
              points={travelData}
              icon={customIcons.meTravel}
              Marker={Marker}
              Popup={Popup}
              PopupContent={PopupWithClose}
            />
          )}

          {/* Сообщение, если точек нет */}
          {Platform.OS === 'web' && mode === 'route' && routePoints.length >= 2 && travel.data && travel.data.length === 0 && (
            <View
              testID="no-points-message"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: [{ translateX: -150 }, { translateY: -60 }],
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                paddingVertical: 20,
                paddingHorizontal: 24,
                borderRadius: 12,
                zIndex: 1000,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
                maxWidth: 300,
                alignItems: 'center',
              }}
            >
              <Text style={{ marginBottom: 8, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Точки не найдены
              </Text>
              <Text style={{ color: '#666', fontSize: 13, textAlign: 'center' }}>
                В радиусе 2 км от маршрута нет доступных точек
              </Text>
            </View>
          )}

          {routingLoading && (
              <View style={styles.routingProgress}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.routingProgressText}>Building route...</Text>
              </View>
          )}

          {errors.routing && (
              <View style={styles.routingError}>
                <Text style={styles.routingErrorText}>Routing error</Text>
              </View>
          )}
        </MapContainer>
        
        {/* ✅ ИСПРАВЛЕНИЕ: Легенда карты перенесена в боковую панель */}
      </View>
  );
};

const Loader: React.FC<{ message: string }> = ({ message }) => (
    <View style={styles.loader}>
      <ActivityIndicator size="large" />
      <Text>{message}</Text>
    </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  map: { flex: 1, width: '100%', height: '100%', minHeight: 300 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#d32f2f', textAlign: 'center' },
  myLocationButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      // Web-specific styles
    }),
  },
  myLocationButtonInner: {
    ...(Platform.OS === 'web' && {
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      backgroundColor: '#fff',
      border: '2px solid rgba(0,0,0,0.2)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      transition: 'all 0.2s ease',
      color: '#2b6cb0',
    }),
  } as any,
  routingProgress: {
    position: 'absolute',
    top: 60,
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(100,100,255,0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routingProgressText: { color: '#fff', marginLeft: 8 },
  routingError: {
    position: 'absolute',
    top: 20,
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(255,80,80,0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
  },
  routingErrorText: { color: '#fff', fontWeight: '600' },
  mobileRouteHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    zIndex: 1000,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
    pointerEvents: 'none',
  } as any,
  mobileRouteHintIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(74,140,140,0.12)',
    color: '#4a8c8c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: '700',
  } as any,
  mobileRouteHintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  } as any,
  mobileRouteHintText: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  } as any,
});

export default React.memo(MapPageComponent);
