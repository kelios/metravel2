import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, DeviceEventEmitter } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { openExternalUrl } from '@/utils/externalLinks';
import { resolveInternalTravelRoute } from '@/utils/relatedTravel';
import { useMapClusters } from '@/hooks/map/useMapClusters';
import type { MapClustersFilters } from '@/api/map';
import {
  buildServerClusterRenderData,
  filterServerClusterRenderDataByRadius,
} from './Map/serverClusterRenderData';
import { getThemedNativeBaseTileUrl } from '@/config/mapWebLayers';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  downloadTileToDisk,
  getCachedTileDataUrl,
  type OfflineBBox,
} from '@/utils/mapTileCache';
import { MapOfflineDownloadControl } from './MapOfflineDownloadControl';
import type { MapMovePayload } from './Map/types';
import {
  isSameViewportSnapshot,
  normalizeRoutePoint,
  parseNativeMapBridgeMessage,
  type NativeViewportSnapshot,
} from './Map/nativeBridge';
import { buildNativeMapHtml } from './Map/nativeMapHtml';
import { serializeForInlineScript } from '@/utils/webViewBridge';

type Point = {
  id?: number | string;
  lat?: string;
  lng?: string;
  coord: string;
  address: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  articleUrl?: string;
  urlTravel?: string;
};

type PaginatedResponse = {
  current_page: number;
  data: Point[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
};

type TravelPropsType = {
  travelAddress?: PaginatedResponse;
  /** Плоская форма, которую передают quests-экраны: { data: Point[] } */
  data?: Point[];
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface TravelProps {
  travel: TravelPropsType;
  coordinates: Coordinates | null;
  /**
   * Реальная геолокация пользователя для маркера «вы здесь». null когда гео
   * недоступна или это fallback-Минск — тогда синяя точка НЕ рисуется.
   * Отделено от coordinates (которые могут быть дефолтным центром).
   */
  userLocation?: Coordinates | null;
  routePoints?: [number, number][];
  fullRouteCoords?: [number, number][];
  mode?: 'radius' | 'route';
  onMapClick?: (lng: number, lat: number) => void;
  /**
   * F-46 — фич-парити с mobile-web: тап по travel-маркеру отдаёт выбранную точку
   * в RN, чтобы экран показал нижнюю карточку (MapPlaceBottomCard) вместо/вместе
   * с Leaflet-попапом. Точка ищется по индексу в переданном массиве points.
   */
  onMarkerSelect?: (point: Point) => void;
  /**
   * F-49 — fired (debounced) on map pan/zoom end with the new center, so the
   * screen can offer a Google-Maps-style "Search this area" action.
   */
  onMapMove?: (center: MapMovePayload) => void;
  mapClusterFilters?: MapClustersFilters;
  /**
   * Категория выбрана, но её имя не смапилось в числовой backend-ID → серверные
   * кластеры не отфильтрованы по категории. Тогда рендерим клиентски
   * отфильтрованный по имени набор точек, чтобы снятие категории убирало маркеры.
   */
  categoryFilterUnresolved?: boolean;
  /**
   * Рендерить ТОЛЬКО переданные `travel.data`, не запрашивая серверный travel/places
   * кластер-эндпоинт. Для карты квестов (`/quests`), где показываем только квесты.
   */
  pointsOnly?: boolean;
  /**
   * Показывать контрол «Скачать эту область» офлайн-карты. Только для главной
   * карты (MapPanel передаёт true). Каталог квестов (pointsOnly) его не включает.
   */
  enableOfflineDownload?: boolean;
  onMapUiApiReady?: (api: {
    zoomIn: () => void;
    zoomOut: () => void;
    centerOnUser: () => void;
    setOverlayEnabled: (id: string, enabled: boolean) => void;
  } | null) => void;
}

const DEFAULT_LAT = 53.8828449;
const DEFAULT_LNG = 27.7273595;

const withAlpha = (color: string, alpha: number) => {
  if (!color || color.startsWith('rgba') || color.startsWith('rgb')) {
    return color;
  }

  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `#${hex}${alphaHex}`;
  }

  return color;
};

const Map: React.FC<TravelProps> = ({
  travel,
  coordinates: propCoordinates,
  userLocation = null,
  routePoints = [],
  fullRouteCoords = [],
  mode = 'radius',
  onMapClick,
  onMarkerSelect,
  onMapMove,
  mapClusterFilters,
  categoryFilterUnresolved = false,
  pointsOnly = false,
  enableOfflineDownload = false,
  onMapUiApiReady,
}) => {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const didAutoCenterOnTrustedUserRef = useRef(false);
  // MapPanel передаёт { travelAddress: { data } }, quests-экраны — { data } напрямую (F-21).
  const travelAddress = useMemo(
    () => travel?.travelAddress?.data ?? travel?.data ?? [],
    [travel?.travelAddress?.data, travel?.data],
  );
  const [viewportSnapshot, setViewportSnapshot] = useState<NativeViewportSnapshot | null>(null);
  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);
  const [isLoading, setIsLoading] = useState(true);
  const themeColors = useThemedColors();
  const { getSiteBaseUrl } = require('@/utils/seo');

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: DEFAULT_LAT, longitude: DEFAULT_LNG });
    }
  }, [localCoordinates]);

  useEffect(() => {
    if (!propCoordinates) return;
    if (!Number.isFinite(propCoordinates.latitude) || !Number.isFinite(propCoordinates.longitude)) return;
    setLocalCoordinates((current) =>
      current?.latitude === propCoordinates.latitude && current?.longitude === propCoordinates.longitude
        ? current
        : propCoordinates,
    );
  }, [propCoordinates]);

  const centerLat = localCoordinates?.latitude ?? DEFAULT_LAT;
  const centerLng = localCoordinates?.longitude ?? DEFAULT_LNG;
  const loaderOverlay = useMemo(
    () => withAlpha(themeColors.surface, 0.8),
    [themeColors.surface]
  );
  const markerShadowColor = withAlpha(themeColors.text, 0.24);
  const selectedRouteLatLngs = useMemo(
    () => routePoints
      .map(normalizeRoutePoint)
      .filter((point): point is [number, number] => Boolean(point)),
    [routePoints],
  );
  const routeLineLatLngs = useMemo(
    () => (fullRouteCoords.length >= 2 ? fullRouteCoords : routePoints)
      .map(normalizeRoutePoint)
      .filter((point): point is [number, number] => Boolean(point)),
    [fullRouteCoords, routePoints],
  );
  const serverClusterQuery = useMapClusters({
    bbox: viewportSnapshot?.bbox ?? null,
    zoom: viewportSnapshot?.zoom ?? 10,
    filters: mapClusterFilters,
    enabled: mode === 'radius' && !pointsOnly,
  });
  const serverClusterRenderData = useMemo(
    () => buildServerClusterRenderData(serverClusterQuery.data),
    [serverClusterQuery.data],
  );
  const radiusFilterCenter = useMemo(() => {
    const lat = Number(mapClusterFilters?.lat);
    const lng = Number(mapClusterFilters?.lng);
    if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
    return { lat: centerLat, lng: centerLng };
  }, [centerLat, centerLng, mapClusterFilters?.lat, mapClusterFilters?.lng]);
  const radiusMeters = useMemo(() => {
    const radiusKm = Number(mapClusterFilters?.radius);
    return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm * 1000 : null;
  }, [mapClusterFilters?.radius]);
  const radiusFilteredServerClusterRenderData = useMemo(
    () => filterServerClusterRenderDataByRadius(
      serverClusterRenderData,
      radiusFilterCenter,
      radiusMeters,
    ),
    [radiusFilterCenter, radiusMeters, serverClusterRenderData],
  );
  // Категория выбрана, но не смапилась в числовой backend-ID → серверные кластеры
  // не отфильтрованы по категории (вернулись все) → откатываемся на клиентски
  // отфильтрованный по имени `travelAddress`, иначе снятие категории не убирает
  // маркеры.
  const shouldUseServerClusterData =
    mode === 'radius' &&
    !serverClusterQuery.isError &&
    radiusFilteredServerClusterRenderData.hasServerData &&
    !categoryFilterUnresolved;
  const renderedNativePoints =
    shouldUseServerClusterData && radiusFilteredServerClusterRenderData.markers.length > 0
      ? radiusFilteredServerClusterRenderData.markers
      : travelAddress;
  const renderedNativeClusters = useMemo(
    () => (shouldUseServerClusterData ? radiusFilteredServerClusterRenderData.clusters : []),
    [radiusFilteredServerClusterRenderData.clusters, shouldUseServerClusterData],
  );
  const renderedNativePointsRef = useRef(renderedNativePoints);
  renderedNativePointsRef.current = renderedNativePoints;

  // Текущий bbox видимой области для контрола «Скачать эту область».
  const offlineBBox = useMemo<OfflineBBox | null>(() => {
    const b = viewportSnapshot?.bbox;
    if (!b) return null;
    if (
      !Number.isFinite(b.south) ||
      !Number.isFinite(b.west) ||
      !Number.isFinite(b.north) ||
      !Number.isFinite(b.east)
    ) {
      return null;
    }
    return { south: b.south, west: b.west, north: b.north, east: b.east };
  }, [viewportSnapshot?.bbox]);

  const injectMapCommand = useCallback((script: string) => {
    try {
      webViewRef.current?.injectJavaScript?.(`${script}; true;`);
    } catch {
      // noop
    }
  }, []);

  // ─────────────── Офлайн-кэш тайлов (Фаза 0: прозрачный кэш) ───────────────
  // Онлайн-статус для TILE_REQ: держим в ref, чтобы async-обработчик не читал
  // устаревшее замыкание. Default true до первого ответа NetInfo — онлайн-путь.
  const { isConnected } = useNetworkStatus();
  const isOnlineRef = useRef(true);
  isOnlineRef.current = isConnected;

  // Шаблон URL базовой подложки ({z}/{x}/{y} подставляем при сетевом промахе).
  const nativeTileTemplate = useMemo(() => getThemedNativeBaseTileUrl(), []);

  // Семафор на сетевые загрузки тайлов: #807 nginx zone режет бурст → 429/серо.
  // Промахи кэша при онлайне качаем ограниченным пулом, попадания идут мимо.
  const tileFetchActiveRef = useRef(0);
  const tileFetchQueueRef = useRef<Array<() => void>>([]);
  const MAX_TILE_FETCH = 3;

  const acquireTileSlot = useCallback((): Promise<void> => {
    if (tileFetchActiveRef.current < MAX_TILE_FETCH) {
      tileFetchActiveRef.current += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      tileFetchQueueRef.current.push(() => {
        tileFetchActiveRef.current += 1;
        resolve();
      });
    });
  }, []);

  const releaseTileSlot = useCallback(() => {
    tileFetchActiveRef.current = Math.max(0, tileFetchActiveRef.current - 1);
    const next = tileFetchQueueRef.current.shift();
    if (next) next();
  }, []);

  const setWebViewTile = useCallback(
    (key: string, dataUrl: string) => {
      injectMapCommand(
        `window.__metravelSetTile && window.__metravelSetTile(${serializeForInlineScript(key)}, ${serializeForInlineScript(dataUrl)})`,
      );
    },
    [injectMapCommand],
  );

  const handleTileRequest = useCallback(
    async (z: number, x: number, y: number, key: string) => {
      try {
        const cached = await getCachedTileDataUrl(z, x, y);
        if (cached) {
          setWebViewTile(key, cached);
          return;
        }
        // Офлайн и нет в кэше → прозрачный тайл (серый фон подложки).
        if (!isOnlineRef.current) {
          setWebViewTile(key, '');
          return;
        }
        // Онлайн-промах: качаем реальный тайл (и попутно кэшируем), затем отдаём
        // как data-URL. Картинка онлайн не меняется — те же тайлы прокси.
        await acquireTileSlot();
        try {
          const url = nativeTileTemplate
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
          const bytes = await downloadTileToDisk(z, x, y, url);
          if (bytes != null) {
            const dataUrl = await getCachedTileDataUrl(z, x, y);
            setWebViewTile(key, dataUrl ?? '');
          } else {
            setWebViewTile(key, '');
          }
        } finally {
          releaseTileSlot();
        }
      } catch {
        setWebViewTile(key, '');
      }
    },
    [acquireTileSlot, nativeTileTemplate, releaseTileSlot, setWebViewTile],
  );

  // F-17 — RN-layout → Leaflet invalidateSize bridge. Когда контейнер карты
  // получает финальную высоту ПОСЛЕ инициализации WebView (карта смонтирована на
  // ещё-не-разложенной вкладке «Карта» в «Мои точки»: таб-бар сверху добирает
  // высоту после первого layout, и WebView успел закэшировать меньший размер →
  // серая полоса ~150px сверху), DOM-событие `resize` внутри WebView не стреляет.
  // Ловим изменение высоты контейнера в RN и дёргаем тот же __metravelScheduleInvalidate,
  // что уже вызывается на init/resize/renderPoints — лишний invalidateSize безвреден.
  const lastLayoutHeightRef = useRef(0);
  // При переключении вкладки «Список → Карта» карта РЕ-монтируется: onLayout с
  // финальной высотой прилетает ДО onLoadEnd WebView (isReadyRef ещё false), и
  // прежний ранний return его терял → Leaflet кэшировал меньший размер, оставляя
  // серую полосу сверху. Теперь запоминаем «нужно пересчитать» и досылаем
  // invalidateSize в handleReady, когда WebView готов.
  const pendingLayoutInvalidateRef = useRef(false);
  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const height = event?.nativeEvent?.layout?.height ?? 0;
      if (!Number.isFinite(height) || height <= 0) return;
      if (Math.abs(height - lastLayoutHeightRef.current) < 1) return;
      lastLayoutHeightRef.current = height;
      if (!isReadyRef.current) {
        pendingLayoutInvalidateRef.current = true;
        return;
      }
      injectMapCommand('window.__metravelScheduleInvalidate && window.__metravelScheduleInvalidate("rn-layout")');
    },
    [injectMapCommand],
  );

  // Состояние включённых оверлеев. Храним в ref, чтобы переприменить их после
  // reload WebView (handleReady) — иначе при пересборке HTML слой пропал бы.
  const enabledOverlaysRef = useRef<Record<string, boolean>>({});

  const setOverlayEnabled = useCallback(
    (id: string, enabled: boolean) => {
      enabledOverlaysRef.current[id] = enabled;
      injectMapCommand(
        `window.__metravelSetOverlay && window.__metravelSetOverlay(${serializeForInlineScript(id)}, ${enabled ? 'true' : 'false'})`,
      );
    },
    [injectMapCommand],
  );

  useEffect(() => {
    if (!onMapUiApiReady) return undefined;

    onMapUiApiReady({
      zoomIn: () => injectMapCommand('window.__metravelMapZoomIn && window.__metravelMapZoomIn()'),
      zoomOut: () => injectMapCommand('window.__metravelMapZoomOut && window.__metravelMapZoomOut()'),
      centerOnUser: () => injectMapCommand('window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser()'),
      setOverlayEnabled,
    });

    return () => onMapUiApiReady(null);
  }, [injectMapCommand, onMapUiApiReady, setOverlayEnabled]);

  // F-17b — на чистой установке при первом открытии «Карты» сверху висят
  // онбординг-коачмарки + системный диалог геолокации, пока WebView инициализируется.
  // После их закрытия геометрия контейнера не меняется (оверлеи — absoluteFill поверх
  // стабильного хоста), поэтому onLayout/DOM-resize не стреляют, а Leaflet не дозапрашивает
  // тайлы под текущий вью → серый фон до первого ручного пана/зума. Ловим детерминированный
  // сигнал «оверлей закрылся» (эмитят MapOnboarding и useMapUserLocation) и дёргаем тот же
  // идемпотентный __metravelScheduleInvalidate — лишний invalidateSize безвреден.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = DeviceEventEmitter.addListener('metravel:map-layout-invalidate', () => {
      injectMapCommand(
        'window.__metravelScheduleInvalidate && window.__metravelScheduleInvalidate("rn-overlay-dismiss")',
      );
    });
    return () => sub.remove();
  }, [injectMapCommand]);

  // Полезная нагрузка для WebView: точки/маршрут/режим/центр. Меняется по приходу
  // данных, но HTML при этом НЕ пересобирается — маркеры дорисовываются injectJavaScript.
  const mapPayload = useMemo(
    () => ({
      points: renderedNativePoints,
      clusters: renderedNativeClusters,
      routePoints: selectedRouteLatLngs,
      routeLine: routeLineLatLngs,
      mode,
      center: { lat: centerLat, lng: centerLng },
      usesServerClusters: shouldUseServerClusterData,
      pointsOnly,
    }),
    [
      renderedNativePoints,
      renderedNativeClusters,
      selectedRouteLatLngs,
      routeLineLatLngs,
      mode,
      centerLat,
      centerLng,
      shouldUseServerClusterData,
      pointsOnly,
    ],
  );

  const pushPayload = useCallback(() => {
    if (!isReadyRef.current) return;
    injectMapCommand(
      `window.__metravelRenderPoints && window.__metravelRenderPoints(${serializeForInlineScript(mapPayload)})`,
    );
  }, [injectMapCommand, mapPayload]);

  // Реальная гео пользователя для маркера «вы здесь». null когда координаты
  // невалидны — синяя точка тогда не рисуется (fallback-Минск отсекается в
  // MapPanel до прокидывания пропа).
  const userLat = userLocation?.latitude;
  const userLng = userLocation?.longitude;
  const userLocationLatLng = useMemo(() => {
    if (userLat == null || userLng == null) return null;
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return null;
    if (Math.abs(userLat) > 90 || Math.abs(userLng) > 180) return null;
    return { lat: userLat, lng: userLng };
  }, [userLat, userLng]);

  const shouldAutoCenterOnTrustedUser = useMemo(() => {
    if (!userLocationLatLng || mode !== 'radius' || pointsOnly) return false;
    return (
      Math.abs(centerLat - userLocationLatLng.lat) <= 0.000001 &&
      Math.abs(centerLng - userLocationLatLng.lng) <= 0.000001
    );
  }, [centerLat, centerLng, mode, pointsOnly, userLocationLatLng]);
  const shouldAutoCenterOnTrustedUserRef = useRef(shouldAutoCenterOnTrustedUser);
  shouldAutoCenterOnTrustedUserRef.current = shouldAutoCenterOnTrustedUser;

  const pushUserLocation = useCallback(() => {
    if (!isReadyRef.current) return;
    if (userLocationLatLng) {
      injectMapCommand(
        `window.__metravelRenderUserLocation && window.__metravelRenderUserLocation(${userLocationLatLng.lat}, ${userLocationLatLng.lng})`,
      );
    } else {
      injectMapCommand('window.__metravelClearUserLocation && window.__metravelClearUserLocation()');
    }
  }, [injectMapCommand, userLocationLatLng]);

  const autoCenterOnTrustedUserIfNeeded = useCallback(() => {
    if (!isReadyRef.current) return;
    if (didAutoCenterOnTrustedUserRef.current) return;
    if (!shouldAutoCenterOnTrustedUserRef.current) return;
    didAutoCenterOnTrustedUserRef.current = true;
    injectMapCommand(
      'window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser()',
    );
  }, [injectMapCommand]);

  // Ref на последние push-функции — чтобы обработчики onLoadEnd/onMessage слали
  // актуальные данные без устаревшего замыкания.
  const pushPayloadRef = useRef(pushPayload);
  pushPayloadRef.current = pushPayload;
  const pushUserLocationRef = useRef(pushUserLocation);
  pushUserLocationRef.current = pushUserLocation;
  // F-49 — always-fresh onMapMove for the WebView message handler.
  const onMapMoveRef = useRef(onMapMove);
  onMapMoveRef.current = onMapMove;

  // Перерисовать маркеры при любом изменении данных (если WebView уже готов).
  useEffect(() => {
    pushPayload();
  }, [pushPayload]);

  // Перерисовать/очистить маркер пользователя при изменении гео.
  useEffect(() => {
    pushUserLocation();
  }, [pushUserLocation]);

  // The WebView can finish its first layout on the Minsk fallback before the
  // Android location promise resolves. Recenter exactly once when the trusted
  // user fix becomes the active radius anchor; later watch ticks and unrelated
  // URL/search/route anchors must not keep yanking the user's viewport.
  useEffect(() => {
    autoCenterOnTrustedUserIfNeeded();
  }, [autoCenterOnTrustedUserIfNeeded, shouldAutoCenterOnTrustedUser]);

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    // F-17 — если контейнер уже разложился до готовности WebView, DOM-resize не
    // сработает; форсим пересчёт размера сразу после ready (без ожидания re-render).
    injectMapCommand('window.__metravelScheduleInvalidate && window.__metravelScheduleInvalidate("ready")');
    // F-17 (re-mount после «Список → Карта»): контейнер получил финальную высоту
    // ещё до готовности WebView. Досылаем ещё один отложенный пересчёт, чтобы
    // Leaflet точно перечитал полный размер и не оставил серую полосу сверху.
    if (pendingLayoutInvalidateRef.current) {
      pendingLayoutInvalidateRef.current = false;
      injectMapCommand(
        'window.__metravelScheduleInvalidate && window.__metravelScheduleInvalidate("rn-layout-pending")',
      );
    }
    pushPayloadRef.current();
    pushUserLocationRef.current();
    autoCenterOnTrustedUserIfNeeded();
    // Переприменяем включённые оверлеи после (ре)загрузки WebView.
    const enabled = enabledOverlaysRef.current;
    Object.keys(enabled).forEach((id) => {
      if (!enabled[id]) return;
      injectMapCommand(
        `window.__metravelSetOverlay && window.__metravelSetOverlay(${serializeForInlineScript(id)}, true)`,
      );
    });
  }, [autoCenterOnTrustedUserIfNeeded, injectMapCommand]);

  // Статичный HTML-каркас: карта + функция window.__metravelRenderPoints.
  // Мемоизирован по теме — стабилен между обновлениями данных, поэтому WebView
  // не перезагружается при каждом приходе точек.
  const htmlContent = useMemo(
    () => buildNativeMapHtml({ themeColors, markerShadowColor }),
    [themeColors, markerShadowColor],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.surface }]}
      onLayout={handleContainerLayout}
    >
      {isLoading && (
        <View style={[styles.loader, { backgroundColor: loaderOverlay }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        // baseUrl даёт WebView реальный https-origin. Без него source={{html}}
        // грузится как about:blank c origin 'null', и браузерный CORS-слой режет
        // ВСЕ fetch к Overpass/WFS (ночёвки, POI, маршруты-сообщества, польские
        // палатки): Overpass отдаёт ACAO '*' и WFS отражает Origin — но только при
        // непустом Origin. Тайлы (Waymarked, OSM) грузятся как <img> и CORS не
        // затрагивает, поэтому маршруты-треки рисовались и без baseUrl.
        source={{ html: htmlContent, baseUrl: 'https://metravel.by/' }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => {
          setIsLoading(false);
          handleReady();
        }}
        onMessage={async (event) => {
          const raw = String(event?.nativeEvent?.data ?? '');
          const message = parseNativeMapBridgeMessage(raw);
          if (!message) return;
          try {
            if (message.type === 'READY') {
              handleReady();
              return;
            }
            if (message.type === 'TILE_REQ') {
              void handleTileRequest(message.z, message.x, message.y, message.key);
              return;
            }
            if (message.type === 'MAP_CLICK') {
              onMapClick?.(message.longitude, message.latitude);
              return;
            }
            if (message.type === 'MAP_MOVED') {
              // F-49 — новый центр карты после панорамирования/зума.
              if (message.move) {
                onMapMoveRef.current?.(message.move);
              }
            }
            if (message.type === 'MAP_MOVED' || message.type === 'MAP_VIEWPORT') {
              if (message.viewport) {
                const nextViewport = message.viewport;
                setViewportSnapshot((current) =>
                  isSameViewportSnapshot(current, nextViewport)
                    ? current
                    : nextViewport,
                );
              }
              return;
            }
            if (message.type === 'SELECT_PLACE') {
              // F-46 — WebView sends stable id/coord plus index fallback. Server
              // cluster updates can replace the points array during zoom, so relying
              // only on the index can miss the tapped marker and fail to open the card.
              const selectablePoints = renderedNativePointsRef.current;
              let selectedPoint = message.id
                ? selectablePoints.find((point) => point?.id != null && String(point.id) === message.id)
                : undefined;
              if (!selectedPoint && message.coord) {
                selectedPoint = selectablePoints.find(
                  (point) => String(point?.coord ?? '').trim() === message.coord,
                );
              }
              if (
                !selectedPoint &&
                message.index != null &&
                message.index >= 0 &&
                message.index < selectablePoints.length
              ) {
                selectedPoint = selectablePoints[message.index];
              }
              if (selectedPoint) onMarkerSelect?.(selectedPoint);
              return;
            }
            if (message.type !== 'OPEN_URL') return;
            const safeUrl = getSafeExternalUrl(message.url, { allowRelative: true, baseUrl: getSiteBaseUrl() });
            if (!safeUrl) return;
            // Travel marker links arrive as absolute URLs against the API host
            // (on local/dev API that host is NOT metravel.by), so route by path
            // regardless of host instead of leaking them to the external browser.
            const internalRoute = resolveInternalTravelRoute(safeUrl);
            if (internalRoute) {
              router.push(internalRoute as any);
              return;
            }
            await openExternalUrl(safeUrl, { allowRelative: true, baseUrl: getSiteBaseUrl() });
          } catch {
            // noop
          }
        }}
        scrollEnabled={true}
      />
      {enableOfflineDownload && !pointsOnly && (
        // bottomInset поднимает FAB над нижним доком навигации (иначе тап уходит в
        // «Ещё»/«Профиль», а сам FAB не виден). ~90dp клирит док+safe-area на телефоне.
        <MapOfflineDownloadControl bbox={offlineBBox} bottomInset={90} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 300,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default Map;
