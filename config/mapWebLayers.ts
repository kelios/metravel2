import { translate as i18nT } from '@/i18n';

export type WebMapLayerKind =
  | 'tile'
  | 'wms'
  | 'osm-overpass-camping'
  | 'osm-overpass-poi'
  | 'osm-overpass-routes'
  | 'osm-overpass-features'
  | 'weather-temp-labels'
  | 'wfs-geojson';

/** Категория для группировки оверлеев по секциям в UI. */
export type WebMapLayerCategory =
  | 'base'
  | 'nature'
  | 'sights'
  | 'services'
  | 'routes'
  | 'weather'
  | 'poland'
  | 'other';

/**
 * Overpass-фильтр для kind 'osm-overpass-features'. Каждая запись — пара
 * key/value (value может быть regex через `~`). Несколько записей объединяются
 * по ИЛИ внутри одного Overpass-запроса.
 */
export interface OverpassFeatureFilter {
  /** OSM-ключ, напр. 'natural', 'tourism', 'amenity', 'historic'. */
  key: string;
  /** Значение тега. Если `regex: true` — трактуется как regex (~"^(...)$"). */
  value: string;
  /** Применять regex-сравнение (~) вместо точного (=). */
  regex?: boolean;
  /** Какие типы OSM-элементов запрашивать. По умолчанию ['node', 'way']. */
  elements?: Array<'node' | 'way' | 'relation'>;
}

export interface WebMapLayerDefinition {
  id: string;
  title: string;
  kind: WebMapLayerKind;
  /** XYZ template for tile layers OR base URL for WMS */
  url: string;
  attribution?: string;
  /** Категория для секционной группировки в FiltersPanelMapSettings. */
  category?: WebMapLayerCategory;
  /** Короткое описание под заголовком в UI. */
  subtitle?: string;
  /** Бейдж-метка (источник данных) в UI. */
  badge?: string;
  /**
   * Имя взаимоисключающей группы. Слои с одинаковым `exclusiveGroup`
   * ведут себя как radio: включение одного выключает остальные в группе.
   * Слои без группы независимы (обычный чекбокс).
   */
  exclusiveGroup?: string;
  /** Overpass-фильтры для kind 'osm-overpass-features'. */
  overpassFilters?: OverpassFeatureFilter[];
  /** Цвет маркера для kind 'osm-overpass-features'. */
  markerColor?: string;
  /**
   * Имя env-переменной, без которой слой недоступен (напр. ключ OWM).
   * Слой полностью скрывается из списка, если переменная не задана.
   */
  requiresEnv?: string;
  /** For WMS */
  wmsParams?: {
    layers: string;
    format?: string;
    transparent?: boolean;
    version?: string;
    styles?: string;
  };
  wfsParams?: {
    typeName: string;
    version?: string;
    outputFormat?: string;
    srsName?: string;
    /** Axis order for bbox parameter: 'lonlat' (default) or 'latlon'. */
    bboxOrder?: 'lonlat' | 'latlon';
  };
  opacity?: number;
  minZoom?: number;
  maxZoom?: number;
  zIndex?: number;
  defaultEnabled?: boolean;
}

/**
 * Порядок секций при группировке оверлеев по category в UI
 * (FiltersPanelMapSettings).
 */
export const OVERLAY_CATEGORY_ORDER = [
  'base',
  'routes',
  'nature',
  'sights',
  'services',
  'poland',
  'weather',
] as const;

/** Категория для оверлеев без заданной category (попадают в конец списка). */
export const OVERLAY_FALLBACK_CATEGORY: WebMapLayerCategory = 'other';

const getOverlayCategoryTitle = (category: string): string => {
  switch (category) {
    case 'base':
      return i18nT('map:config.mapWebLayers.category.base');
    case 'routes':
      return i18nT('map:config.mapWebLayers.category.routes');
    case 'nature':
      return i18nT('map:config.mapWebLayers.category.nature');
    case 'sights':
      return i18nT('map:config.mapWebLayers.category.sights');
    case 'services':
      return i18nT('map:config.mapWebLayers.category.services');
    case 'poland':
      return i18nT('map:config.mapWebLayers.category.poland');
    case 'weather':
      return i18nT('map:config.mapWebLayers.category.weather');
    case 'other':
      return i18nT('map:config.mapWebLayers.category.other');
    default:
      return category;
  }
};

interface OverlayCategorizable {
  id: string;
  category?: string;
}

/**
 * Группирует оверлеи по category в фиксированном порядке OVERLAY_CATEGORY_ORDER.
 * Неизвестные категории (включая отсутствующую) уходят в конец в порядке появления.
 */
export const groupOverlaysByCategory = <T extends OverlayCategorizable>(
  items: ReadonlyArray<T>,
): Array<{ category: string; title: string; items: T[] }> => {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const category =
      item.category && item.category.trim() ? item.category : OVERLAY_FALLBACK_CATEGORY;
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(item);
    else byCategory.set(category, [item]);
  }

  const ordered: Array<{ category: string; title: string; items: T[] }> = [];
  for (const category of OVERLAY_CATEGORY_ORDER) {
    const bucket = byCategory.get(category);
    if (bucket && bucket.length) {
      ordered.push({ category, title: getOverlayCategoryTitle(category), items: bucket });
      byCategory.delete(category);
    }
  }
  for (const [category, bucket] of byCategory) {
    if (bucket.length) {
      ordered.push({ category, title: getOverlayCategoryTitle(category), items: bucket });
    }
  }
  return ordered;
};

const OWM_API_KEY_ENV = 'EXPO_PUBLIC_OWM_API_KEY';

/**
 * Значения env читаем через явные литеральные обращения к process.env.*,
 * иначе Metro не заинлайнит EXPO_PUBLIC_* на web (динамический доступ
 * process.env[name] остаётся undefined в браузерном бандле).
 */
const ENV_VALUES: Record<string, string> = {
  [OWM_API_KEY_ENV]: String(process.env.EXPO_PUBLIC_OWM_API_KEY || '').trim(),
};

const readEnv = (name?: string): string => (name ? ENV_VALUES[name] || '' : '');

/** OWM ключ читаем из env, НЕ хардкодим. */
export const getOwmApiKey = (): string => readEnv(OWM_API_KEY_ENV);

const owmTileUrl = (layerCode: string): string =>
  `https://tile.openweathermap.org/map/${layerCode}/{z}/{x}/{y}.png?appid={owmApiKey}`;

/**
 * Web-only overlay layers.
 *
 * Важно: URL для Lasy Państwowe / «miejsca biwakowe» зависит от публичного сервиса.
 * Я добавил плейсхолдеры через env, чтобы можно было включить без правок кода.
 */
export const WEB_MAP_OVERLAY_LAYERS: WebMapLayerDefinition[] = [
  // ───────────────────────────── Подложки (opaque tile) ─────────────────────────────
  {
    id: 'base-satellite',
    get title() { return i18nT('map:config.mapWebLayers.layer.baseSatellite.title'); },
    kind: 'tile',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    get attribution() { return i18nT('map:config.mapWebLayers.layer.baseSatellite.attribution'); },
    category: 'base',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.baseSatellite.subtitle'); },
    badge: 'Esri',
    opacity: 1,
    maxZoom: 19,
    zIndex: 200,
    defaultEnabled: false,
  },
  {
    id: 'base-topo',
    get title() { return i18nT('map:config.mapWebLayers.layer.baseTopo.title'); },
    kind: 'tile',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
    category: 'base',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.baseTopo.subtitle'); },
    badge: 'Topo',
    opacity: 1,
    maxZoom: 17,
    zIndex: 210,
    defaultEnabled: false,
  },
  {
    id: 'overlay-hillshade',
    get title() { return i18nT('map:config.mapWebLayers.layer.hillshade.title'); },
    kind: 'tile',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    get attribution() { return i18nT('map:config.mapWebLayers.layer.hillshade.attribution'); },
    category: 'base',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.hillshade.subtitle'); },
    badge: 'Esri',
    opacity: 0.45,
    maxZoom: 19,
    zIndex: 230,
    defaultEnabled: false,
  },

  // ───────────────────────────── Природа (Overpass features) ─────────────────────────────
  {
    id: 'nature-water',
    get title() { return i18nT('map:config.mapWebLayers.layer.natureWater.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'nature',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.natureWater.subtitle'); },
    badge: 'OSM',
    markerColor: '#0a84ff',
    overpassFilters: [
      { key: 'natural', value: '^(spring|water|waterfall)$', regex: true, elements: ['node', 'way'] },
      { key: 'waterway', value: 'waterfall', elements: ['node'] },
    ],
    minZoom: 12,
    opacity: 1,
    zIndex: 460,
    defaultEnabled: false,
  },
  {
    id: 'nature-viewpoint',
    get title() { return i18nT('map:config.mapWebLayers.layer.natureViewpoint.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'nature',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.natureViewpoint.subtitle'); },
    badge: 'OSM',
    markerColor: '#34c759',
    overpassFilters: [{ key: 'tourism', value: 'viewpoint', elements: ['node', 'way'] }],
    minZoom: 12,
    opacity: 1,
    zIndex: 461,
    defaultEnabled: false,
  },
  {
    id: 'nature-peak',
    get title() { return i18nT('map:config.mapWebLayers.layer.naturePeak.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'nature',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.naturePeak.subtitle'); },
    badge: 'OSM',
    markerColor: '#8e6b3a',
    overpassFilters: [{ key: 'natural', value: 'peak', elements: ['node'] }],
    minZoom: 12,
    opacity: 1,
    zIndex: 462,
    defaultEnabled: false,
  },
  {
    id: 'nature-shelter',
    get title() { return i18nT('map:config.mapWebLayers.layer.natureShelter.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'nature',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.natureShelter.subtitle'); },
    badge: 'OSM',
    markerColor: '#5e5ce6',
    overpassFilters: [
      { key: 'amenity', value: 'shelter', elements: ['node', 'way'] },
      { key: 'tourism', value: 'wilderness_hut', elements: ['node', 'way'] },
    ],
    minZoom: 12,
    opacity: 1,
    zIndex: 463,
    defaultEnabled: false,
  },

  // ───────────────────────────── Достопримечательности (Overpass features) ─────────────────────────────
  {
    id: 'sights-historic',
    get title() { return i18nT('map:config.mapWebLayers.layer.sightsHistoric.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'sights',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.sightsHistoric.subtitle'); },
    badge: 'OSM',
    markerColor: '#ff9f0a',
    overpassFilters: [
      {
        key: 'historic',
        value: '^(castle|manor|fort|ruins|archaeological_site|monument|memorial)$',
        regex: true,
        elements: ['node', 'way'],
      },
    ],
    minZoom: 11,
    opacity: 1,
    zIndex: 470,
    defaultEnabled: false,
  },
  {
    id: 'sights-museum',
    get title() { return i18nT('map:config.mapWebLayers.layer.sightsMuseum.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'sights',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.sightsMuseum.subtitle'); },
    badge: 'OSM',
    markerColor: '#bf5af2',
    overpassFilters: [{ key: 'tourism', value: 'museum', elements: ['node', 'way'] }],
    minZoom: 11,
    opacity: 1,
    zIndex: 471,
    defaultEnabled: false,
  },

  // ───────────────────────────── Сервисы (Overpass features, minZoom 12) ─────────────────────────────
  {
    id: 'service-fuel',
    get title() { return i18nT('map:config.mapWebLayers.layer.serviceFuel.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'services',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.serviceFuel.subtitle'); },
    badge: 'OSM',
    markerColor: '#ff453a',
    overpassFilters: [{ key: 'amenity', value: 'fuel', elements: ['node', 'way'] }],
    minZoom: 12,
    opacity: 1,
    zIndex: 472,
    defaultEnabled: false,
  },
  {
    id: 'service-aid',
    get title() { return i18nT('map:config.mapWebLayers.layer.serviceAid.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'services',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.serviceAid.subtitle'); },
    badge: 'OSM',
    markerColor: '#30d158',
    overpassFilters: [
      { key: 'amenity', value: '^(pharmacy|hospital|clinic|doctors)$', regex: true, elements: ['node', 'way'] },
    ],
    minZoom: 12,
    opacity: 1,
    zIndex: 473,
    defaultEnabled: false,
  },
  {
    id: 'service-transit',
    get title() { return i18nT('map:config.mapWebLayers.layer.serviceTransit.title'); },
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'services',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.serviceTransit.subtitle'); },
    badge: 'OSM',
    markerColor: '#64d2ff',
    overpassFilters: [
      { key: 'railway', value: 'station', elements: ['node', 'way'] },
      { key: 'amenity', value: 'bus_station', elements: ['node', 'way'] },
    ],
    minZoom: 12,
    opacity: 1,
    zIndex: 474,
    defaultEnabled: false,
  },

  // ───────────────────────────── Маршруты ─────────────────────────────
  {
    id: 'waymarked-hiking',
    get title() { return i18nT('map:config.mapWebLayers.layer.waymarkedHiking.title'); },
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
    category: 'routes',
    subtitle: 'Waymarked Trails: hiking',
    get badge() { return i18nT('map:config.mapWebLayers.badge.tracks'); },
    opacity: 0.95,
    zIndex: 520,
    defaultEnabled: false,
  },
  {
    id: 'waymarked-cycling',
    get title() { return i18nT('map:config.mapWebLayers.layer.waymarkedCycling.title'); },
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
    category: 'routes',
    subtitle: 'Waymarked Trails: cycling',
    get badge() { return i18nT('map:config.mapWebLayers.badge.tracks'); },
    opacity: 0.95,
    zIndex: 515,
    defaultEnabled: false,
  },
  {
    id: 'osm-camping',
    get title() { return i18nT('map:config.mapWebLayers.layer.osmCamping.title'); },
    kind: 'osm-overpass-camping',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'nature',
    subtitle: 'OSM: camp / shelter',
    badge: 'OSM',
    opacity: 1,
    minZoom: 12,
    zIndex: 500,
    defaultEnabled: false,
  },
  {
    id: 'osm-poi',
    get title() { return i18nT('map:config.mapWebLayers.layer.osmPoi.title'); },
    kind: 'osm-overpass-poi',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'sights',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.osmPoi.subtitle'); },
    badge: 'OSM',
    opacity: 1,
    minZoom: 11,
    zIndex: 480,
    defaultEnabled: false,
  },
  {
    id: 'osm-routes',
    get title() { return i18nT('map:config.mapWebLayers.layer.osmRoutes.title'); },
    kind: 'osm-overpass-routes',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'routes',
    subtitle: 'OSM: hiking / bicycle',
    badge: 'OSM',
    opacity: 1,
    minZoom: 12,
    zIndex: 470,
    defaultEnabled: false,
  },

  // ───────────────────────────── Погода (OWM, требует ключа) ─────────────────────────────
  {
    id: 'weather-clouds',
    get title() { return i18nT('map:config.mapWebLayers.layer.weatherClouds.title'); },
    kind: 'tile',
    url: owmTileUrl('clouds_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'weather',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.weatherClouds.subtitle'); },
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    exclusiveGroup: 'weather-heatmap',
    opacity: 0.85,
    maxZoom: 19,
    zIndex: 540,
    defaultEnabled: false,
  },
  {
    id: 'weather-precip',
    get title() { return i18nT('map:config.mapWebLayers.layer.weatherPrecip.title'); },
    kind: 'tile',
    url: owmTileUrl('precipitation_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'weather',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.weatherPrecip.subtitle'); },
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    exclusiveGroup: 'weather-heatmap',
    opacity: 0.9,
    maxZoom: 19,
    zIndex: 541,
    defaultEnabled: false,
  },
  {
    id: 'weather-temp',
    get title() { return i18nT('map:config.mapWebLayers.layer.weatherTemp.title'); },
    kind: 'tile',
    url: owmTileUrl('temp_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'weather',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.weatherTemp.subtitle'); },
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    exclusiveGroup: 'weather-heatmap',
    opacity: 0.8,
    maxZoom: 19,
    zIndex: 542,
    defaultEnabled: false,
  },
  {
    id: 'weather-temp-labels',
    get title() { return i18nT('map:config.mapWebLayers.layer.weatherTempLabels.title'); },
    kind: 'weather-temp-labels',
    url: '',
    attribution: 'Weather data © OpenWeatherMap',
    category: 'weather',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.weatherTempLabels.subtitle'); },
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    opacity: 1,
    minZoom: 6,
    zIndex: 560,
    defaultEnabled: false,
  },

  // ───────────────────────────── Польша ─────────────────────────────
  {
    id: 'lasy-zanocuj-wfs',
    get title() { return i18nT('map:config.mapWebLayers.layer.lasyZanocuj.title'); },
    kind: 'wfs-geojson',
    url:
      process.env.EXPO_PUBLIC_LASY_WFS_URL ||
      'https://mapserver.bdl.lasy.gov.pl/arcgis/services/WFS_BDL_mapa_turystyczna/MapServer/WFSServer',
    attribution:
      process.env.EXPO_PUBLIC_LASY_ATTRIBUTION ||
      'Źródło: Bank Danych o Lasach (BDL) – Program „Zanocuj w lesie”',
    category: 'poland',
    get subtitle() { return i18nT('map:config.mapWebLayers.layer.lasyZanocuj.subtitle'); },
    badge: 'PL',
    wfsParams: {
      typeName:
        process.env.EXPO_PUBLIC_LASY_WFS_TYPENAME ||
        'WFS_BDL_mapa_turystyczna:Obszar_programu_Zanocuj_w_lesie',
      version: process.env.EXPO_PUBLIC_LASY_WFS_VERSION || '2.0.0',
      outputFormat: process.env.EXPO_PUBLIC_LASY_WFS_OUTPUT || 'GEOJSON',
      srsName: process.env.EXPO_PUBLIC_LASY_WFS_SRS || 'EPSG:4326',
      bboxOrder: 'latlon',
    },
    opacity: 0.8,
    zIndex: 450,
    defaultEnabled: false,
  },
];

/**
 * Слои, доступные в текущем окружении: отфильтрованы по requiresEnv
 * (слой без заданной env-переменной ПОЛНОСТЬЮ скрывается, а не дизейблится).
 */
/** Подставляет {owmApiKey} в URL из env (вызывается только для активных слоёв). */
const resolveLayerUrl = (layer: WebMapLayerDefinition): WebMapLayerDefinition => {
  if (layer.requiresEnv === OWM_API_KEY_ENV && layer.url.includes('{owmApiKey}')) {
    const resolved = Object.create(
      Object.getPrototypeOf(layer),
      Object.getOwnPropertyDescriptors(layer),
    ) as WebMapLayerDefinition;
    resolved.url = layer.url.replace('{owmApiKey}', getOwmApiKey());
    return resolved;
  }
  return layer;
};

/** id heatmap-слоя температуры (заливка). */
export const WEATHER_TEMP_LAYER_ID = 'weather-temp';
/** id слоя числовых подписей °C (живёт независимо от heatmap-группы). */
export const WEATHER_TEMP_LABELS_LAYER_ID = 'weather-temp-labels';

/**
 * Возвращает id всех слоёв из той же exclusiveGroup, что и заданный слой
 * (исключая сам слой). Пусто, если слой без группы или не найден.
 */
export const getExclusiveGroupSiblings = (id: string): string[] => {
  const target = WEB_MAP_OVERLAY_LAYERS.find((l) => l.id === id);
  if (!target?.exclusiveGroup) return [];
  return WEB_MAP_OVERLAY_LAYERS.filter(
    (l) => l.exclusiveGroup === target.exclusiveGroup && l.id !== id,
  ).map((l) => l.id);
};

export const getActiveOverlayLayers = (): WebMapLayerDefinition[] =>
  WEB_MAP_OVERLAY_LAYERS.filter((layer) => {
    if (!layer.requiresEnv) return true;
    return Boolean(readEnv(layer.requiresEnv));
  }).map(resolveLayerUrl);

/**
 * Same-origin путь до OSM tile-прокси бэкенда (#156). Использовать прямой
 * tile.openstreetmap.org на web запрещено (OSM Tile Usage Policy). Без `{s}`:
 * прокси не использует субдомены, поэтому в Leaflet НЕ задаём `subdomains`.
 */
export const OSM_PROXY_TILE_PATH = '/proxy/tiles/osm/{z}/{x}/{y}.png';
export const OSM_PROXY_ATTRIBUTION = '&copy; OpenStreetMap contributors';
export const OSM_PROXY_MAX_ZOOM = 19;

/**
 * Origin, от которого резолвится прокси-путь.
 * - Прод (web на metravel.by): относительный путь резолвится same-origin — возвращаем как есть.
 * - Dev/preview (localhost / Metro): у локального сервера нет `/proxy/tiles`,
 *   поэтому собираем абсолютный URL на публичный origin из EXPO_PUBLIC_API_URL.
 */
const getOsmProxyOrigin = (): string | null => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!raw) return null;
    const base = raw.replace(/\/api\/?$/i, '');
    const parsed = new URL(base);
    const host = parsed.hostname.toLowerCase();
    // Локальный/LAN backend тайл-прокси не отдаёт — оставляем относительный путь
    // (на web он резолвится от window.origin), либо абсолютный публичный.
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;
    return parsed.origin || null;
  } catch {
    return null;
  }
};

/**
 * Итоговый tile-URL базового OSM-слоя на web.
 * На localhost/Metro собираем абсолютный публичный URL: origin из
 * EXPO_PUBLIC_API_URL, а если он сам локальный (Metro/прокси без
 * `/proxy/tiles`) — прод metravel.by, иначе тайлы отдаёт dev-сервер
 * HTML-ками и карта серая. На проде same-origin путь резолвится сам.
 */
export const getOsmTileUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = String(window.location?.hostname || '').toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (isLocalHost) {
      const origin = getOsmProxyOrigin() || OSM_PROXY_PUBLIC_ORIGIN;
      return `${origin}${OSM_PROXY_TILE_PATH}`;
    }
  }
  return OSM_PROXY_TILE_PATH;
};

/** Публичный origin с tile-прокси — фолбэк, когда EXPO_PUBLIC_API_URL недоступен для тайлов. */
const OSM_PROXY_PUBLIC_ORIGIN = 'https://metravel.by';

/**
 * crossOrigin для базового OSM-слоя: 'anonymous' нужен канвас-снапшотам карты
 * и допустим только для same-origin тайлов (прод, относительный путь).
 * Кросс-доменный dev-фолбэк (metravel.by с localhost) CORS-заголовков не шлёт —
 * с crossOrigin такие тайлы падают целиком, оставляем обычные <img>.
 */
export const getOsmTileCrossOrigin = (): 'anonymous' | undefined => {
  const url = getOsmTileUrl();
  if (!/^https?:\/\//i.test(url)) return 'anonymous';
  if (typeof window !== 'undefined') {
    try {
      if (new URL(url).origin === window.location.origin) return 'anonymous';
    } catch {
      // noop
    }
  }
  return undefined;
};

/**
 * Хост, у которого заведомо НЕТ tile-прокси и/или к которому Android WebView
 * не пустит mixed-content: loopback, приватные LAN-подсети (RFC1918) или
 * cleartext `http://`. Для таких origin native обязан фолбэкнуться на прод.
 */
const isUnreachableTileOrigin = (parsed: URL): boolean => {
  if (parsed.protocol !== 'https:') return true; // cleartext → mixed-content на Android
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  // RFC1918 приватные подсети: 10.*, 192.168.*, 172.16–31.*
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
};

/**
 * Абсолютный tile-URL базового OSM-слоя для native (Leaflet-в-WebView, #202).
 * На native нет same-origin: WebView грузит inline-HTML, поэтому относительный
 * путь `/proxy/tiles/...` некуда резолвить — нужен абсолютный https-URL.
 *
 * В dev `EXPO_PUBLIC_API_URL` указывает на LAN-бэкенд (напр. `http://192.168.x.x`),
 * у которого НЕТ `/proxy/tiles` → тайлы 404 → серая карта. Поэтому для
 * loopback/LAN/cleartext-origin фолбэкаем на публичный прод-домен, у которого
 * прокси заведомо есть. Прод-origin (`https://metravel.by`) проходит без изменений.
 * Касается ТОЛЬКО native — web-ветка (`getOsmTileUrl`) не затрагивается.
 */
export const getOsmNativeTileUrl = (): string => {
  let origin = OSM_PROXY_PUBLIC_ORIGIN;
  try {
    const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (raw) {
      const parsed = new URL(raw.replace(/\/api\/?$/i, ''));
      if (!isUnreachableTileOrigin(parsed) && parsed.origin) {
        origin = parsed.origin;
      }
    }
  } catch {
    origin = OSM_PROXY_PUBLIC_ORIGIN;
  }
  return `${origin}${OSM_PROXY_TILE_PATH}`;
};

/**
 * CARTO «dark_all» — бесплатный OSM-совместимый тёмный стиль. Константы
 * сохранены для обратной совместимости импортов, но базовая подложка карты
 * больше НЕ переключается на тёмную при тёмной теме UI: пользователь хочет
 * обычную (светлую) карту независимо от темы приложения. Тёмными остаются
 * только панели/контролы/маркеры (контраст), не сами тайлы карты.
 */
export const CARTO_DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const CARTO_DARK_SUBDOMAINS = 'abcd';
export const CARTO_DARK_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
export const CARTO_DARK_MAX_ZOOM = 20;

/**
 * Базовая подложка карты. Всегда светлая (OSM-прокси) — независимо от темы
 * приложения. `isDark` принимается для обратной совместимости вызовов, но
 * игнорируется: пользователь хочет обычный цвет карты в тёмной теме.
 * Одна точка истины для web (useMapInstance) и native (Map.ios.tsx).
 */
export const getThemedBaseTileUrl = (_isDark?: boolean): string => getOsmTileUrl();

/** Native-вариант: всегда светлая подложка, URL абсолютный (нет same-origin). */
export const getThemedNativeBaseTileUrl = (_isDark?: boolean): string =>
  getOsmNativeTileUrl();

export const getThemedBaseAttribution = (_isDark?: boolean): string =>
  OSM_PROXY_ATTRIBUTION;

export const getThemedBaseMaxZoom = (_isDark?: boolean): number => OSM_PROXY_MAX_ZOOM;

export const WEB_MAP_BASE_LAYERS: WebMapLayerDefinition[] = [
  {
    id: 'osm',
    title: 'OpenStreetMap',
    kind: 'tile',
    url: getOsmTileUrl(),
    attribution: OSM_PROXY_ATTRIBUTION,
    maxZoom: OSM_PROXY_MAX_ZOOM,
    defaultEnabled: true,
  },
];
