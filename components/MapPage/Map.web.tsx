// components/MapPage/Map.web.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { METRICS } from '@/constants/layout';
import * as Location from 'expo-location';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import RoutingMachine from './RoutingMachine';
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { buildGpx, buildKml, downloadTextFileWeb } from '@/src/utils/routeExport';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';
import { attachOsmCampingOverlay } from '@/src/utils/mapWebOverlays/osmCampingOverlay';
import type { MapUiApi } from '@/src/types/mapUi';

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
  onMapUiApiReady?: (api: MapUiApi | null) => void;
}

const MOBILE_BREAKPOINT = METRICS.breakpoints.tablet || 768;
// ✅ ОПТИМИЗАЦИЯ: Снижен порог кластеризации для улучшения производительности
const CLUSTER_THRESHOLD = 25;
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
  renderer?: any; // ✅ УЛУЧШЕНИЕ: Canvas Renderer для производительности
}

const TravelMarkers: React.FC<TravelMarkersProps> = ({ points, icon, Marker, Popup, PopupContent, markerOpacity = 1, renderer }) => {
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
        
        // ✅ УЛУЧШЕНИЕ: Передаем renderer только если есть много маркеров (>50)
        const markerOptions: any = {
          position: [coords[1], coords[0]],
          icon,
          opacity: markerOpacity,
        };

        if (renderer && points.length > 50) {
          markerOptions.renderer = renderer;
        }

        return (
          <Marker
            key={markerKey}
            {...markerOptions}
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
  if (prev.icon !== next.icon || prev.Marker !== next.Marker || prev.Popup !== next.Popup || prev.PopupContent !== next.PopupContent || prev.renderer !== next.renderer) {
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
  renderer?: any; // ✅ УЛУЧШЕНИЕ: Canvas Renderer для производительности
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
  renderer,
}) => {
  const colors = useThemedColors();
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

  // ✅ УЛУЧШЕНИЕ: Мемоизированный кеш иконок для популярных значений
  const clusterIconsCache = useMemo(() => {
    if (!(window as any)?.L?.divIcon) return new Map();

    const cache = new Map();
    const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const primary = root?.getPropertyValue('--color-primary')?.trim() || colors.primary;
    const textOnDark = root?.getPropertyValue('--color-textOnDark')?.trim() || colors.textOnDark;
    const shadow = root?.getPropertyValue('--shadow-medium')?.trim() || colors.boxShadows.medium;
    const border = root?.getPropertyValue('--color-border')?.trim() || colors.border;

    // Кешируем популярные значения: 2, 5, 10, 20, 50, 100, 200
    [2, 5, 10, 20, 50, 100, 200].forEach(count => {
      const icon = (window as any).L.divIcon({
        className: 'custom-cluster-icon',
        // Важно: держим строку style в одной строке, чтобы анализатор не пытался парсить как CSS-файл
        html: `<div style="background:${primary};color:${textOnDark};width:42px;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:${shadow};border:2px solid ${border};">${count}</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      cache.set(count, icon);
    });

    return cache;
  }, [colors]);

  const clusterIcon = useCallback(
    (count: number) => {
      if (!(window as any)?.L?.divIcon) return undefined;

      // ✅ УЛУЧШЕНИЕ: Используем кешированную иконку если есть
      if (clusterIconsCache.has(count)) {
        return clusterIconsCache.get(count);
      }

      // Для нестандартных значений создаем на лету
      const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
      const primary = root?.getPropertyValue('--color-primary')?.trim() || colors.primary;
      const textOnDark = root?.getPropertyValue('--color-textOnDark')?.trim() || colors.textOnDark;
      const shadow = root?.getPropertyValue('--shadow-medium')?.trim() || colors.boxShadows.medium;
      const border = root?.getPropertyValue('--color-border')?.trim() || colors.border;

      return (window as any).L.divIcon({
        className: 'custom-cluster-icon',
        html: `<div style="background:${primary};color:${textOnDark};width:42px;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:${shadow};border:2px solid ${border};">${count}</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
    },
    [colors, clusterIconsCache]
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

                // ✅ УЛУЧШЕНИЕ: Используем Canvas Renderer для производительности
                const markerProps: any = {
                  key: markerKey,
                  position: [ll[1], ll[0]],
                  icon: markerIcon,
                  opacity: markerOpacity,
                };
                if (renderer) markerProps.renderer = renderer;

                return (
                  <Marker {...markerProps}>
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

                // ✅ УЛУЧШЕНИЕ: Используем Canvas Renderer для производительности
                const markerProps: any = {
                  key: markerKey,
                  position: [ll[1], ll[0]],
                  icon: markerIcon,
                  opacity: markerOpacity,
                };
                if (renderer) markerProps.renderer = renderer;

                return (
                  <Marker {...markerProps}>
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

          // ✅ УЛУЧШЕНИЕ: Используем Canvas Renderer для производительности
          const singleMarkerProps: any = {
            key: `cluster-single-${idx}`,
            position: [ll[1], ll[0]],
            icon: markerIcon,
            opacity: markerOpacity,
          };
          if (renderer) singleMarkerProps.renderer = renderer;

          return (
            <Marker {...singleMarkerProps}>
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
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Нажмите, чтобы приблизить и раскрыть маркеры
                </Text>
                {cluster.items.slice(0, 6).map((p, i) => (
                  <Text key={`${cluster.key}-item-${i}`} numberOfLines={1} style={{ fontSize: 12 }}>
                    {p.categoryName ? `${p.categoryName}: ` : ''}{p.address || 'Без названия'}
                  </Text>
                ))}
                {cluster.items.length > 6 && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    …и ещё {cluster.items.length - 6}
                  </Text>
                )}
              </View>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const MapPageComponent: React.FC<Props> = (props) => {
  const {
    travel = { data: [] },
    coordinates,
    routePoints,
    onMapClick,
    mode,
    transportMode,
    setRouteDistance,
    setFullRouteCoords,
    radius,
  } = props;

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
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const renderLoader = useCallback(
    (message: string) => (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text>{message}</Text>
      </View>
    ),
    [colors.primary, styles.loader]
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

  // Полное удаление экземпляра карты при размонтировании, чтобы Leaflet не ругался на переиспользование контейнера
  useEffect(() => {
    return () => {
      try {
        const map = mapRef.current;
        const container = map?.getContainer?.();
        map?.off?.();
        map?.remove?.();
        if (container && (container as any)._leaflet_id) {
          try {
            delete (container as any)._leaflet_id;
          } catch {
            // noop
          }
        }
      } catch {
        // noop
      } finally {
        mapRef.current = null;
      }
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

  // ✅ УЛУЧШЕНИЕ: Canvas Renderer для лучшей производительности при >50 маркеров
  const canvasRenderer = useMemo(() => {
    if (!L || typeof (L as any).canvas !== 'function') return undefined;

    // Создаем Canvas Renderer с оптимальными настройками
    return (L as any).canvas({
      padding: 0.5, // Увеличивает viewport для рендеринга за пределами видимой области
      tolerance: 10, // Увеличивает точность кликов на маркеры
    });
  }, [L]);

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
        if (status !== 'granted') {
          setErrors((prev) => ({ ...prev, location: true }));
          return;
        }
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
  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${Math.random().toString(36).slice(2)}`);

  // На случай горячей перезагрузки/ошибок очищаем старые контейнеры Leaflet перед инициализацией
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const containers = document.querySelectorAll('.leaflet-container');
    containers.forEach((el) => {
      const anyEl = el as any;
      if (anyEl._leaflet_id) {
        try {
          delete anyEl._leaflet_id;
        } catch {
          // noop
        }
      }
    });
  }, []);

  // Функция для центрирования на местоположении пользователя (должна быть до условных возвратов)
  const centerOnUserLocation = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.setView([userLocation.latitude, userLocation.longitude], 13, { animate: true });
  }, [userLocation]);

  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    if (!props.onMapUiApiReady) return;
    if (!mapInstance || !L) return;

    const api: MapUiApi = {
      zoomIn: () => {
        try {
          mapInstance.zoomIn();
        } catch {
          // noop
        }
      },
      zoomOut: () => {
        try {
          mapInstance.zoomOut();
        } catch {
          // noop
        }
      },
      centerOnUser: () => centerOnUserLocation(),
      fitToResults: () => {
        try {
          if (!mapInstance || !L) return;
          if (typeof (L as any).latLngBounds !== 'function' || typeof (L as any).latLng !== 'function') return;

          const coords = (travelData || [])
            .map((p) => strToLatLng(p.coord))
            .filter(Boolean) as [number, number][];

          if (coords.length === 0 && userLocation) {
            coords.push([userLocation.longitude, userLocation.latitude]);
          }

          if (coords.length === 0) return;

          const bounds = (L as any).latLngBounds(coords.map(([lng, lat]) => (L as any).latLng(lat, lng)));
          mapInstance.fitBounds(bounds.pad(0.2), { animate: false });
        } catch {
          // noop
        }
      },
      exportGpx: () => handleDownloadGpx(),
      exportKml: () => handleDownloadKml(),
      setBaseLayer: (id: string) => {
        try {
          const def = WEB_MAP_BASE_LAYERS.find((d) => d.id === id);
          if (!def) return;
          const newLayer = createLeafletLayer(L, def);
          if (!newLayer) return;

          const current = leafletBaseLayerRef.current;
          if (current && mapInstance.hasLayer?.(current)) {
            mapInstance.removeLayer(current);
          }
          leafletBaseLayerRef.current = newLayer;
          newLayer.addTo(mapInstance);
        } catch {
          // noop
        }
      },
      setOverlayEnabled: (id: string, enabled: boolean) => {
        try {
          const layer = leafletOverlayLayersRef.current.get(id);
          if (!layer) return;

          if (enabled) {
            layer.addTo(mapInstance);
          } else if (mapInstance.hasLayer?.(layer)) {
            mapInstance.removeLayer(layer);
          }

          const overpassController = (leafletControlRef as any).overpassController;
          if (overpassController?.layer === layer) {
            if (enabled) overpassController.start?.();
            else overpassController.stop?.();
          }
        } catch {
          // noop
        }
      },
    };

    props.onMapUiApiReady(api);
    return () => {
      props.onMapUiApiReady?.(null);
    };
  }, [L, mapInstance, props, centerOnUserLocation, handleDownloadGpx, handleDownloadKml, travelData, userLocation]);

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
    onMapReady: (map: any) => void;
    savedMapViewRef: React.MutableRefObject<any>;
    hasInitializedRef: React.MutableRefObject<boolean>;
    lastModeRef: React.MutableRefObject<MapMode | null>;
    lastAutoFitKeyRef: React.MutableRefObject<string | null>;
    leafletBaseLayerRef: React.MutableRefObject<any>;
    leafletOverlayLayersRef: React.MutableRefObject<Map<string, any>>;
    leafletControlRef: React.MutableRefObject<any>;
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
    onMapReady,
    savedMapViewRef,
    hasInitializedRef,
    lastModeRef,
    lastAutoFitKeyRef,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
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
      onMapReady(map);
      try {
        setMapZoom(map.getZoom());
      } catch {
        // noop
      }
    }, [map, mapRef, onMapReady, setMapZoom]);

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

    
    useEffect(() => {
      if (Platform.OS !== 'web') return;
      if (!map || !L) return;
      if (typeof map.addLayer !== 'function') return;

      const overpassControllerRef: any = (leafletControlRef as any);

      try {
        leafletOverlayLayersRef.current.forEach((layer) => {
          try {
            if (map.hasLayer?.(layer)) map.removeLayer(layer);
          } catch {
            // noop
          }
        });
        leafletOverlayLayersRef.current.clear();
      } catch {
        // noop
      }

      const baseDef = WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled) || WEB_MAP_BASE_LAYERS[0];
      if (baseDef) {
        const baseLayer = createLeafletLayer(L, baseDef);
        if (baseLayer) {
          leafletBaseLayerRef.current = baseLayer;
        }
      }

      const baseLayers: Record<string, any> = {};
      if (leafletBaseLayerRef.current) {
        baseLayers[WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled)?.title || 'Base'] = leafletBaseLayerRef.current;
      }

      const overlays: Record<string, any> = {};

      const overpassDef = WEB_MAP_OVERLAY_LAYERS.find((d) => d.kind === 'osm-overpass-camping');
      let overpassController: ReturnType<typeof attachOsmCampingOverlay> | null = null;
      if (overpassDef) {
        try {
          overpassController = attachOsmCampingOverlay(L, map, {
            maxAreaKm2: 2500,
            debounceMs: 700,
          });
          leafletOverlayLayersRef.current.set(overpassDef.id, overpassController.layer);
          overlays[overpassDef.title] = overpassController.layer;
          (overpassControllerRef as any).overpassController = overpassController;
        } catch {
          // noop
        }
      }

      WEB_MAP_OVERLAY_LAYERS.filter((d) => d.kind !== 'osm-overpass-camping').forEach((def) => {
        const layer = createLeafletLayer(L, def);
        if (!layer) return;
        leafletOverlayLayersRef.current.set(def.id, layer);
        overlays[def.title] = layer;
      });

      try {
        const baseLayer = leafletBaseLayerRef.current;
        if (baseLayer && !map.hasLayer?.(baseLayer)) {
          baseLayer.addTo(map);
        }
      } catch {
        // noop
      }

      WEB_MAP_OVERLAY_LAYERS.filter((d) => d.defaultEnabled).forEach((def) => {
        const layer = leafletOverlayLayersRef.current.get(def.id);
        if (layer) {
          try {
            layer.addTo(map);
            if ((overpassControllerRef as any).overpassController?.layer === layer) {
              (overpassControllerRef as any).overpassController?.start?.();
            }
          } catch {
            // noop
          }
        }
      });

      return () => {
        try {
          overpassController?.stop();
          // Удаляем слой, если он был добавлен
          if (overpassController?.layer && map.hasLayer?.(overpassController.layer)) {
            map.removeLayer(overpassController.layer);
          }
        } catch {
          // noop
        }
      };
    }, [map, L, leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef]);

    return null;
  };

  // Compute center before any early returns to keep hook order stable
  const safeCenter = useMemo<[number, number]>(() => {
    const lat = Number.isFinite(coordinates.latitude) ? coordinates.latitude : 53.8828449;
    const lng = Number.isFinite(coordinates.longitude) ? coordinates.longitude : 27.7273595;
    return [lat, lng];
  }, [coordinates.latitude, coordinates.longitude]);

  const leafletBaseLayerRef = useRef<any>(null);
  const leafletOverlayLayersRef = useRef<Map<string, any>>(new Map());
  const leafletControlRef = useRef<any>(null);

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  const canExportRoute = useMemo(() => {
    // Предпочитаем fullRouteCoords (точный трек), иначе fallback на routePoints.
    // В этом компоненте fullRouteCoords доступен только через setFullRouteCoords,
    // но сами coords в Map.web приходят через parent (MapPanel -> MapScreen).
    // Поэтому ориентируемся на routePoints и режим.
    if (mode !== 'route') return false;
    return Array.isArray(routePoints) && routePoints.length >= 2;
  }, [mode, routePoints]);

  const buildExportInput = useCallback(
    (kind: 'gpx' | 'kml') => {
      // Попытаемся экспортировать лучший трек: если parent передаёт fullRouteCoords, он будет в props.
      // Если нет — используем routePoints как минимальный трек.
      const anyProps = props as any;
      const fullRouteCoords = Array.isArray(anyProps.fullRouteCoords) ? (anyProps.fullRouteCoords as [number, number][]) : [];

      const track = fullRouteCoords.length >= 2 ? fullRouteCoords : routePoints;

      const waypoints = routePoints.length >= 1 ? [
        { name: 'Start', coordinates: routePoints[0] },
        ...(routePoints.length >= 2 ? [{ name: 'End', coordinates: routePoints[routePoints.length - 1] }] : []),
      ] : [];

      const name = `Metravel route`;
      const description =
        fullRouteCoords.length >= 2
          ? 'Route track exported from Metravel (full route geometry)'
          : 'Route track exported from Metravel (waypoints only)';

      return { name, description, track, waypoints, time: new Date().toISOString(), kind };
    },
    [props, routePoints]
  );

  const handleDownloadGpx = useCallback(() => {
    if (!canExportRoute) return;
    const input = buildExportInput('gpx');
    const file = buildGpx({
      name: input.name,
      description: input.description,
      track: input.track,
      waypoints: input.waypoints,
      time: input.time,
    });
    downloadTextFileWeb(file);
  }, [buildExportInput, canExportRoute]);

  const handleDownloadKml = useCallback(() => {
    if (!canExportRoute) return;
    const input = buildExportInput('kml');
    const file = buildKml({
      name: input.name,
      description: input.description,
      track: input.track,
      waypoints: input.waypoints,
      time: input.time,
    });
    downloadTextFileWeb(file);
  }, [buildExportInput, canExportRoute]);

  if (loading) return renderLoader('Loading map...');

  if (!L || !rl) {
    return renderLoader(errors.loadingModules ? 'Loading map modules failed' : 'Loading map...');
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

      <MapContainer
        style={styles.map as any}
        center={safeCenter}
        zoom={initialZoomRef.current}
        key={mapInstanceKeyRef.current}
        zoomControl={false}
      >
        <TileLayer
          attribution={WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled)?.attribution || '&copy; OpenStreetMap contributors'}
          url={WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled)?.url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
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
          onMapReady={setMapInstance}
          savedMapViewRef={savedMapViewRef}
          hasInitializedRef={hasInitializedRef}
          lastModeRef={lastModeRef}
          lastAutoFitKeyRef={lastAutoFitKeyRef}
          leafletBaseLayerRef={leafletBaseLayerRef}
          leafletOverlayLayersRef={leafletOverlayLayersRef}
          leafletControlRef={leafletControlRef}
        />

        {mode === 'radius' && radiusInMeters && (
          <Circle
            center={[coordinates.latitude, coordinates.longitude]}
            radius={radiusInMeters}
            pathOptions={{
              color: colors.primary,
              fillColor: colors.primary,
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
            renderer={canvasRenderer}
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
            renderer={canvasRenderer}
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

const getStyles = (colors: ThemedColors) => StyleSheet.create({
wrapper: {
flex: 1,
width: '100%',
height: '100%',
borderRadius: 16,
overflow: 'hidden',
backgroundColor: colors.backgroundSecondary,
position: 'relative',
},
map: { flex: 1, width: '100%', height: '100%', minHeight: 300 },
loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
errorText: { color: colors.danger, textAlign: 'center' },
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
backgroundColor: colors.info,
border: `2px solid ${colors.borderStrong}`,
boxShadow: colors.boxShadows.card,
cursor: 'pointer',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
padding: 0,
transition: 'all 0.2s ease',
color: colors.textOnPrimary,
}),
} as any,
routingProgress: {
position: 'absolute',
top: 60,
left: '10%',
right: '10%',
backgroundColor: colors.info,
padding: 10,
borderRadius: 8,
zIndex: 1000,
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'center',
},
routingProgressText: { color: colors.textOnPrimary, marginLeft: 8 },
routingError: {
position: 'absolute',
top: 20,
left: '10%',
right: '10%',
backgroundColor: colors.danger,
padding: 10,
borderRadius: 8,
zIndex: 1000,
alignItems: 'center',
},
routingErrorText: { color: colors.textOnPrimary, fontWeight: '600' },
mobileRouteHint: {
display: 'flex',
gap: 10,
backgroundColor: colors.infoDark,
color: colors.textOnDark,
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
backgroundColor: colors.overlayLight,
color: colors.textOnDark,
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontSize: 18,
fontWeight: '700',
},
mobileRouteHintTitle: {
fontSize: 14,
fontWeight: '700',
color: colors.textOnDark,
marginBottom: 2,
},
mobileRouteHintText: {
fontSize: 14,
fontWeight: '600',
marginBottom: 4,
color: colors.textOnDark,
},
});

export default React.memo(MapPageComponent);
