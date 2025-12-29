// components/MapPage/Map.web.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { METRICS } from '@/constants/layout';
import * as Location from 'expo-location';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import RoutingMachine from './RoutingMachine';
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';
import { CoordinateConverter } from '@/utils/coordinateConverter';
// MapLegend is currently unused in the web map

type ReactLeafletNS = typeof import('react-leaflet');

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
  setRoutePoints?: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  radius?: string; // Радиус поиска в км
}

const MOBILE_BREAKPOINT = METRICS.breakpoints.tablet || 768;
const CLUSTER_THRESHOLD = 50;
const CLUSTER_GRID = 0.045; // ~5 км ячейка на широте 55-60
const CLUSTER_EXPAND_ZOOM = 15;

const getClusterGridForZoom = (zoom: number) => {
  if (!Number.isFinite(zoom)) return CLUSTER_GRID;
  if (zoom >= 16) return 0.0015;
  if (zoom >= 15) return 0.0025;
  if (zoom >= 14) return 0.005;
  if (zoom >= 13) return 0.01;
  if (zoom >= 12) return 0.02;
  if (zoom >= 11) return 0.03;
  return CLUSTER_GRID;
};

const strToLatLng = (s: string): [number, number] | null => {
  const parsed = CoordinateConverter.fromLooseString(s);
  if (!parsed) return null;
  return [parsed.lng, parsed.lat];
};

const buildClusterKey = (center: [number, number], count: number) =>
  `${center[0].toFixed(5)}|${center[1].toFixed(5)}|${count}`;

// ✅ ОПТИМИЗАЦИЯ: Мемоизированный компонент маркеров для предотвращения лишних перерисовок
interface TravelMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>; // Передаем компонент попапа как проп
  markerOpacity?: number;
}

const TravelMarkers: React.FC<TravelMarkersProps> = ({ points, icon, Marker, Popup, PopupContent, markerOpacity = 1 }) => {
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
            opacity={markerOpacity}
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

const ClusterLayer: React.FC<{
  points: Point[];
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>;
  onClusterZoom: (payload: {
    center: [number, number];
    bounds: [[number, number], [number, number]];
    key: string;
    items: Point[];
  }) => void;
  expandedClusterKey?: string | null;
  expandedClusterItems?: Point[] | null;
  markerIcon?: any;
  markerOpacity?: number;
  grid: number;
  expandClusters: boolean;
}> = ({
  points,
  Marker,
  Popup,
  PopupContent,
  onClusterZoom,
  expandedClusterKey,
  expandedClusterItems,
  markerIcon,
  markerOpacity = 1,
  grid,
  expandClusters,
}) => {
  const clusters = useMemo(() => {
    const byCell: Record<string, { items: Point[]; minLat: number; maxLat: number; minLng: number; maxLng: number }> = {};
    points.forEach((p) => {
      const ll = strToLatLng(p.coord);
      if (!ll) return;
      const [lng, lat] = ll;
      const cellLat = Math.floor(lat / grid) * grid;
      const cellLng = Math.floor(lng / grid) * grid;
      const key = `${cellLat.toFixed(3)}|${cellLng.toFixed(3)}`;
      if (!byCell[key]) {
        byCell[key] = { items: [], minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
      }
      byCell[key].items.push(p);
      byCell[key].minLat = Math.min(byCell[key].minLat, lat);
      byCell[key].maxLat = Math.max(byCell[key].maxLat, lat);
      byCell[key].minLng = Math.min(byCell[key].minLng, lng);
      byCell[key].maxLng = Math.max(byCell[key].maxLng, lng);
    });
    return Object.values(byCell).map((cell) => {
      const count = cell.items.length;
      const centerLat = (cell.minLat + cell.maxLat) / 2;
      const centerLng = (cell.minLng + cell.maxLng) / 2;
      const key = buildClusterKey([centerLat, centerLng], count);
      return {
        key,
        count,
        center: [centerLat, centerLng] as [number, number],
        bounds: [
          [cell.minLat, cell.minLng] as [number, number],
          [cell.maxLat, cell.maxLng] as [number, number],
        ],
        items: cell.items,
      };
    });
  }, [points, grid]);

  const clusterIcon = useCallback(
    (count: number) =>
      (window as any)?.L?.divIcon
        ? (window as any).L.divIcon({
            className: 'custom-cluster-icon',
            html: `<div style="
              background: rgba(74,140,140,0.9);
              color:#fff;
              width:42px;height:42px;
              border-radius:21px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:800;
              box-shadow:0 6px 18px rgba(0,0,0,0.18);
              border:2px solid #f8f5f2;
            ">${count}</div>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          })
        : undefined,
    []
  );

  return (
    <>
      {clusters.map((cluster, idx) => {
        if (expandClusters) {
          return (
            <React.Fragment key={`cluster-auto-expanded-${cluster.key}-${idx}`}>
              {cluster.items.map((item, itemIdx) => {
                const ll = strToLatLng(item.coord);
                if (!ll) return null;
                const markerKey = item.id
                  ? `cluster-auto-expanded-${cluster.key}-${item.id}`
                  : `cluster-auto-expanded-${cluster.key}-${item.coord.replace(/,/g, '-')}-${itemIdx}`;
                return (
                  <Marker
                    key={markerKey}
                    position={[ll[1], ll[0]]}
                    icon={markerIcon}
                    opacity={markerOpacity}
                  >
                    <Popup>
                      <PopupContent point={item} />
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        }

        // Expanded cluster: render individual markers instead of a single cluster bubble
        if (expandedClusterKey && cluster.key === expandedClusterKey) {
          const items = expandedClusterItems ?? cluster.items;
          return (
            <React.Fragment key={`expanded-${cluster.key}-${idx}`}>
              {items.map((item, itemIdx) => {
                const ll = strToLatLng(item.coord);
                if (!ll) return null;
                const markerKey = item.id
                  ? `cluster-expanded-${cluster.key}-${item.id}`
                  : `cluster-expanded-${cluster.key}-${item.coord.replace(/,/g, '-')}-${itemIdx}`;
                return (
                  <Marker
                    key={markerKey}
                    position={[ll[1], ll[0]]}
                    icon={markerIcon}
                    opacity={markerOpacity}
                  >
                    <Popup>
                      <PopupContent point={item} />
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        }

        const icon = clusterIcon(cluster.count);
        if (cluster.count === 1 && cluster.items[0]) {
          const item = cluster.items[0];
          const ll = strToLatLng(item.coord);
          if (!ll) return null;
          return (
            <Marker
              key={`cluster-single-${idx}`}
              position={[ll[1], ll[0]]}
              icon={markerIcon}
              opacity={markerOpacity}
            >
              <Popup>
                <PopupContent point={item} />
              </Popup>
            </Marker>
          );
        }

        return (
          <Marker
            key={`cluster-${idx}`}
            position={[cluster.center[0], cluster.center[1]]}
            icon={icon as any}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.preventDefault?.();
                e?.originalEvent?.stopPropagation?.();
                onClusterZoom({
                  center: [cluster.center[0], cluster.center[1]],
                  bounds: [
                    [cluster.bounds[0][0], cluster.bounds[0][1]],
                    [cluster.bounds[1][0], cluster.bounds[1][1]],
                  ],
                  key: cluster.key,
                  items: cluster.items,
                });
              },
            }}
          >
            <Popup>
              <View style={{ gap: 6, maxWidth: 260 }}>
                <Text style={{ fontWeight: '800' }}>{cluster.count} мест поблизости</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  Нажмите, чтобы приблизить и раскрыть маркеры
                </Text>
                {cluster.items.slice(0, 6).map((p, i) => (
                  <Text key={`${cluster.key}-item-${i}`} numberOfLines={1} style={{ fontSize: 12 }}>
                    {p.categoryName ? `${p.categoryName}: ` : ''}{p.address || 'Без названия'}
                  </Text>
                ))}
                {cluster.items.length > 6 && (
                  <Text style={{ fontSize: 12, color: '#666' }}>…и ещё {cluster.items.length - 6}</Text>
                )}
              </View>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const MapPageComponent: React.FC<Props> = ({
                                             travel = { data: [] },
                                             coordinates,
                                             routePoints,
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
  const [, setRoutingLoading] = useState(false);
  const [disableFitBounds, setDisableFitBounds] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<{ key: string; items: Point[] } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const travelData = useMemo(
    () => (Array.isArray(travel?.data) ? travel.data : []),
    [travel?.data]
  );
  const shouldCluster = travelData.length > CLUSTER_THRESHOLD;
  const travelMarkerOpacity = mode === 'route' ? 0.45 : 1;
  const clusterGrid = useMemo(() => getClusterGridForZoom(mapZoom), [mapZoom]);
  const expandClusters = mapZoom >= CLUSTER_EXPAND_ZOOM;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setIsNarrow(window.innerWidth < MOBILE_BREAKPOINT);
    update();

    if (typeof window.matchMedia === 'function') {
      const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
      const handler = () => setIsNarrow(media.matches);
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
    }

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

    if (!isTestEnv && (Platform.OS !== 'web' || typeof window === 'undefined')) return;

    const load = async () => {
      try {
        const { L, rl: rlMod } = await ensureLeafletAndReactLeaflet();
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

  const RoutingMachineWithMapInner = useMemo(() => {
    if (!rl) return null;
    const useMap = (rl as any).useMap;
    const Comp: React.FC<any> = (props) => {
      const map = useMap();
      return <RoutingMachine map={map} {...props} />;
    };
    return Comp;
  }, [rl]);

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
      // Avoid double updates: delegate point creation to parent handler only
      setDisableFitBounds(true);
      onMapClick(e.latlng.lng, e.latlng.lat);
    },
    [mode, routePoints.length, onMapClick]
  );

  // Сбрасываем блокировку fitBounds после выбора точек или переключения режима
  useEffect(() => {
    if (mode === 'radius') {
      setDisableFitBounds(false);
      setExpandedCluster(null);
      return;
    }
    if (mode === 'route' && routePoints.length >= 2) {
      setDisableFitBounds(false);
    }
    if (mode === 'route' && routePoints.length === 0) {
      setDisableFitBounds(false);
      setExpandedCluster(null);
    }
  }, [mode, routePoints.length]);

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
  const initialZoomRef = useRef<number>(
    Number.isFinite((coordinates as any).zoom) ? (coordinates as any).zoom : 11
  );

  // ✅ ИСПРАВЛЕНИЕ: Используем useRef для отслеживания инициализации
  // Должны быть объявлены ДО условных возвратов, чтобы соблюдать правила хуков
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<MapMode | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const lastAutoFitKeyRef = useRef<string | null>(null);

  // Функция для центрирования на местоположении пользователя (должна быть до условных возвратов)
  const centerOnUserLocation = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.setView([userLocation.latitude, userLocation.longitude], 13, { animate: true });
  }, [userLocation]);

  // invalidateSize на resize (полезно для раскрытия/скрытия панели)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = () => {
      if (!mapRef.current) return;
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        try {
          mapRef.current?.invalidateSize?.();
        } catch {
          // noop
        }
      });
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

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

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } = rlSafe;

  // Компонент для управления закрытием попапа (внутри MapContainer)
  const PopupWithClose = useMemo(() => {
    const Comp: React.FC<{ point: Point }> = ({ point }) => {
      const map = useMap();

      const handleClose = useCallback(() => {
        map.closePopup();
      }, [map]);

      return <PopupContentComponent travel={point} onClose={handleClose} />;
    };
    return Comp;
  }, [useMap]);

  const MapLogic: React.FC<{
    mapClickHandler: (e: any) => void;
    mode: MapMode;
    coordinates: Coordinates;
    userLocation: Coordinates | null;
    disableFitBounds: boolean;
    L: any;
    travelData: Point[];
    setMapZoom: (z: number) => void;
    setExpandedCluster: (v: { key: string; items: Point[] } | null) => void;
    mapRef: React.MutableRefObject<any>;
    savedMapViewRef: React.MutableRefObject<any>;
    hasInitializedRef: React.MutableRefObject<boolean>;
    lastModeRef: React.MutableRefObject<MapMode | null>;
    lastAutoFitKeyRef: React.MutableRefObject<string | null>;
  }> = ({
    mapClickHandler,
    mode,
    coordinates,
    userLocation,
    disableFitBounds,
    L,
    travelData,
    setMapZoom,
    setExpandedCluster,
    mapRef,
    savedMapViewRef,
    hasInitializedRef,
    lastModeRef,
    lastAutoFitKeyRef,
  }) => {
    const map = useMap();

    useMapEvents({
      click: mapClickHandler,
      zoomend: () => {
        try {
          const z = map.getZoom();
          setMapZoom(z);
        } catch {
          // noop
        }
      },
      zoomstart: () => {
        setExpandedCluster(null);
        try {
          map.closePopup();
        } catch {
          // noop
        }
      },
    });

    // Keep map ref for imperative calls (fitBounds, setView)
    useEffect(() => {
      mapRef.current = map;
      try {
        setMapZoom(map.getZoom());
      } catch {
        // noop
      }
    }, [map, mapRef, setMapZoom]);

    // ✅ Popup behavior: close reliably on map click or zoom.
    // This must NOT trigger rerenders (no state), only imperative map calls.
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

    // Route mode: keep map stable (no auto fitBounds)
    useEffect(() => {
      if (!map) return;
      if (mode === 'route') {
        if (!hasInitializedRef.current && coordinates.latitude && coordinates.longitude) {
          map.setView([coordinates.latitude, coordinates.longitude], 13, { animate: false });
          hasInitializedRef.current = true;
        }
        lastModeRef.current = mode;
        return;
      }

      if (lastModeRef.current === 'route' && mode === 'radius') {
        hasInitializedRef.current = false;
      }

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
    }, [map, mode, coordinates, userLocation, hasInitializedRef, lastModeRef]);

    // Fit bounds to all travel points (radius mode only)
    useEffect(() => {
      if (!map) return;
      if (disableFitBounds || mode === 'route') return;
      if (!L || typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

      const dataKey = (travelData || [])
        .map((p) => (p.id != null ? `id:${p.id}` : `c:${p.coord}`))
        .join('|');
      const autoFitKey = `${mode}:${dataKey}:${userLocation ? `${userLocation.latitude},${userLocation.longitude}` : 'no-user'}`;
      if (lastAutoFitKeyRef.current === autoFitKey) return;

      const coords = travelData
        .map((p) => strToLatLng(p.coord))
        .filter(Boolean) as [number, number][];

      if (coords.length === 0 && userLocation) {
        coords.push([userLocation.longitude, userLocation.latitude]);
      }

      if (coords.length === 0) return;

      try {
        const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
        map.fitBounds(bounds.pad(0.2), { animate: false });
        lastAutoFitKeyRef.current = autoFitKey;
      } catch {
        // noop
      }
    }, [map, disableFitBounds, mode, L, travelData, userLocation, lastAutoFitKeyRef]);

    return null;
  };

  // Compute center before any early returns to keep hook order stable
  const safeCenter = useMemo<[number, number]>(() => {
    const lat = Number.isFinite(coordinates.latitude) ? coordinates.latitude : 53.8828449;
    const lng = Number.isFinite(coordinates.longitude) ? coordinates.longitude : 27.7273595;
    return [lat, lng];
  }, [coordinates.latitude, coordinates.longitude]);

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  if (loading) return <Loader message="Loading map..." />;

  if (!L || !rl) {
    return <Loader message={errors.loadingModules ? 'Loading map modules failed' : 'Loading map...'} />;
  }

  return (
    <View style={styles.wrapper}>
      {noPointsAlongRoute && (
        <View
          testID="no-points-message"
          style={{ width: 0, height: 0, overflow: 'hidden' }}
          accessible
          accessibilityRole="text"
        >
          <Text>Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км.</Text>
        </View>
      )}

      {/* Кнопка "Мое местоположение" */}
      {userLocation && Platform.OS === 'web' && (
        <div
          style={{
            position: 'absolute',
            top: isNarrow ? undefined : 10,
            right: isNarrow ? 16 : 10,
            bottom: isNarrow ? 80 : undefined,
            zIndex: 1000,
          }}
        >
          <button
            onClick={centerOnUserLocation}
            title="Мое местоположение"
            aria-label="Вернуться к моему местоположению"
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
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor" />
            </svg>
          </button>
        </div>
      )}

      <MapContainer
        style={styles.map as any}
        center={safeCenter}
        zoom={initialZoomRef.current}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapLogic
          mapClickHandler={handleMapClick}
          mode={mode}
          coordinates={coordinates}
          userLocation={userLocation}
          disableFitBounds={disableFitBounds}
          L={L}
          travelData={travelData}
          setMapZoom={setMapZoom}
          setExpandedCluster={setExpandedCluster}
          mapRef={mapRef}
          savedMapViewRef={savedMapViewRef}
          hasInitializedRef={hasInitializedRef}
          lastModeRef={lastModeRef}
          lastAutoFitKeyRef={lastAutoFitKeyRef}
        />

        {mode === 'radius' && radiusInMeters && (
          <Circle
            center={[coordinates.latitude, coordinates.longitude]}
            radius={radiusInMeters}
            pathOptions={{
              color: '#4a8c8c',
              fillColor: '#4a8c8c',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6 6',
            }}
          />
        )}

        {routePoints.length >= 1 && customIcons?.start && (
          <Marker
            position={[routePoints[0][1], routePoints[0][0]]}
            icon={customIcons.start}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
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
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
            }}
          >
            <Popup>End</Popup>
          </Marker>
        )}

        {mode === 'route' && routePoints.length >= 2 && rl && RoutingMachineWithMapInner && (
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
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={customIcons.userLocation}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        {customIcons?.meTravel && travelData.length > 0 && !shouldCluster && (
          <TravelMarkersMemo
            points={travelData}
            icon={customIcons.meTravel}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupWithClose}
            // @ts-ignore
            opacity={travelMarkerOpacity}
          />
        )}

        {customIcons?.meTravel && travelData.length > 0 && shouldCluster && (
          <ClusterLayer
            points={travelData}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupWithClose}
            markerIcon={customIcons.meTravel}
            markerOpacity={travelMarkerOpacity}
            grid={clusterGrid}
            expandClusters={expandClusters}
            expandedClusterKey={expandedCluster?.key}
            expandedClusterItems={expandedCluster?.items}
            onClusterZoom={({ bounds, key, items }) => {
              if (!mapRef.current) return;
              try {
                const map = mapRef.current;
                map.closePopup();
                setExpandedCluster({ key, items });
                map.fitBounds(
                  [
                    [bounds[0][0], bounds[0][1]],
                    [bounds[1][0], bounds[1][1]],
                  ],
                  { padding: [40, 40], animate: true }
                );
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
backgroundColor: '#0c2b43',
border: '2px solid rgba(0,0,0,0.2)',
boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
cursor: 'pointer',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
padding: 0,
transition: 'all 0.2s ease',
color: '#fff',
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
display: 'flex',
gap: 10,
backgroundColor: '#0c2b43',
color: '#fff',
position: 'absolute',
left: 12,
right: 12,
top: 12,
zIndex: 1000,
borderRadius: 16,
padding: 12,
},
mobileRouteHintIcon: {
width: 40,
height: 40,
borderRadius: 12,
backgroundColor: 'rgba(255,255,255,0.12)',
color: '#fff',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontSize: 18,
fontWeight: '700',
},
mobileRouteHintTitle: {
fontSize: 14,
fontWeight: '700',
color: '#fff',
marginBottom: 2,
},
mobileRouteHintText: {
fontSize: 14,
fontWeight: '600',
marginBottom: 4,
},
});

export default React.memo(MapPageComponent);
