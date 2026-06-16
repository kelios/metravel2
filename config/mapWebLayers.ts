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
  | 'Подложки'
  | 'Природа'
  | 'Достопримечательности'
  | 'Сервисы'
  | 'Маршруты'
  | 'Погода'
  | 'Польша';

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
  /** Категория для секционной группировки в OverlaysPopover. */
  category?: WebMapLayerCategory;
  /** Короткое описание под заголовком в UI. */
  subtitle?: string;
  /** Бейдж-метка (источник данных) в UI. */
  badge?: string;
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
 * (OverlaysPopover и FiltersPanelMapSettings используют один и тот же порядок).
 */
export const OVERLAY_CATEGORY_ORDER = [
  'Подложки',
  'Маршруты',
  'Природа',
  'Достопримечательности',
  'Сервисы',
  'Польша',
  'Погода',
] as const;

/** Категория для оверлеев без заданной category (попадают в конец списка). */
export const OVERLAY_FALLBACK_CATEGORY = 'Другое';

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
): Array<{ category: string; items: T[] }> => {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const category =
      item.category && item.category.trim() ? item.category : OVERLAY_FALLBACK_CATEGORY;
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(item);
    else byCategory.set(category, [item]);
  }

  const ordered: Array<{ category: string; items: T[] }> = [];
  for (const category of OVERLAY_CATEGORY_ORDER) {
    const bucket = byCategory.get(category);
    if (bucket && bucket.length) {
      ordered.push({ category, items: bucket });
      byCategory.delete(category);
    }
  }
  for (const [category, bucket] of byCategory) {
    if (bucket.length) ordered.push({ category, items: bucket });
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
    title: 'Спутник',
    kind: 'tile',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Источник: Esri, Maxar, Earthstar Geographics, GIS User Community',
    category: 'Подложки',
    subtitle: 'Спутниковые снимки Esri World Imagery',
    badge: 'Esri',
    opacity: 1,
    maxZoom: 19,
    zIndex: 200,
    defaultEnabled: false,
  },
  {
    id: 'base-topo',
    title: 'Топографическая',
    kind: 'tile',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
    category: 'Подложки',
    subtitle: 'OpenTopoMap (рельеф, горизонтали)',
    badge: 'Topo',
    opacity: 1,
    maxZoom: 17,
    zIndex: 210,
    defaultEnabled: false,
  },
  {
    id: 'overlay-hillshade',
    title: 'Рельеф (отмывка)',
    kind: 'tile',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Источник: Esri, USGS, NOAA | World Hillshade',
    category: 'Подложки',
    subtitle: 'Полупрозрачная отмывка рельефа',
    badge: 'Esri',
    opacity: 0.45,
    maxZoom: 19,
    zIndex: 230,
    defaultEnabled: false,
  },

  // ───────────────────────────── Природа (Overpass features) ─────────────────────────────
  {
    id: 'nature-water',
    title: 'Водоёмы и источники',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Природа',
    subtitle: 'Озёра, родники, водопады (OSM)',
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
    title: 'Смотровые площадки',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Природа',
    subtitle: 'Видовые точки (OSM)',
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
    title: 'Вершины',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Природа',
    subtitle: 'Горные вершины с высотой (OSM)',
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
    title: 'Укрытия и навесы',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Природа',
    subtitle: 'Туристические укрытия (OSM)',
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
    title: 'Исторические объекты',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Достопримечательности',
    subtitle: 'Замки, усадьбы, руины (OSM)',
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
    title: 'Музеи',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Достопримечательности',
    subtitle: 'Музеи и галереи (OSM)',
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
    title: 'Заправки',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Сервисы',
    subtitle: 'АЗС (OSM)',
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
    title: 'Аптеки и медпомощь',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Сервисы',
    subtitle: 'Аптеки, больницы, медпункты (OSM)',
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
    title: 'Транспорт',
    kind: 'osm-overpass-features',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Сервисы',
    subtitle: 'Вокзалы и остановки (OSM)',
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
    title: 'Пешие маршруты (Waymarked Trails)',
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
    category: 'Маршруты',
    subtitle: 'Waymarked Trails: hiking',
    badge: 'Треки',
    opacity: 0.95,
    zIndex: 520,
    defaultEnabled: false,
  },
  {
    id: 'waymarked-cycling',
    title: 'Веломаршруты (Waymarked Trails)',
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
    category: 'Маршруты',
    subtitle: 'Waymarked Trails: cycling',
    badge: 'Треки',
    opacity: 0.95,
    zIndex: 515,
    defaultEnabled: false,
  },
  {
    id: 'osm-camping',
    title: 'Ночёвки/кемпинги (OSM: camp/shelter)',
    kind: 'osm-overpass-camping',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Природа',
    subtitle: 'OSM: camp / shelter',
    badge: 'OSM',
    opacity: 1,
    minZoom: 12,
    zIndex: 500,
    defaultEnabled: false,
  },
  {
    id: 'osm-poi',
    title: 'Достопримечательности (OSM)',
    kind: 'osm-overpass-poi',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Достопримечательности',
    subtitle: 'Интересные места из OSM',
    badge: 'OSM',
    opacity: 1,
    minZoom: 11,
    zIndex: 480,
    defaultEnabled: false,
  },
  {
    id: 'osm-routes',
    title: 'Маршруты сообщества (OSM)',
    kind: 'osm-overpass-routes',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    category: 'Маршруты',
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
    title: 'Облачность',
    kind: 'tile',
    url: owmTileUrl('clouds_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'Погода',
    subtitle: 'OpenWeatherMap: облачность',
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    opacity: 0.85,
    maxZoom: 19,
    zIndex: 540,
    defaultEnabled: false,
  },
  {
    id: 'weather-precip',
    title: 'Осадки',
    kind: 'tile',
    url: owmTileUrl('precipitation_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'Погода',
    subtitle: 'OpenWeatherMap: осадки',
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    opacity: 0.9,
    maxZoom: 19,
    zIndex: 541,
    defaultEnabled: false,
  },
  {
    id: 'weather-temp',
    title: 'Температура',
    kind: 'tile',
    url: owmTileUrl('temp_new'),
    attribution: 'Weather data © OpenWeatherMap',
    category: 'Погода',
    subtitle: 'OpenWeatherMap: температура',
    badge: 'OWM',
    requiresEnv: OWM_API_KEY_ENV,
    opacity: 0.8,
    maxZoom: 19,
    zIndex: 542,
    defaultEnabled: false,
  },
  {
    id: 'weather-temp-labels',
    title: 'Температура °C (подписи)',
    kind: 'weather-temp-labels',
    url: '',
    attribution: 'Weather data © OpenWeatherMap',
    category: 'Погода',
    subtitle: 'OpenWeatherMap: числовая температура по городам',
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
    title: 'Польша: места палаток (Zanocuj w lesie)',
    kind: 'wfs-geojson',
    url:
      process.env.EXPO_PUBLIC_LASY_WFS_URL ||
      'https://mapserver.bdl.lasy.gov.pl/arcgis/services/WFS_BDL_mapa_turystyczna/MapServer/WFSServer',
    attribution:
      process.env.EXPO_PUBLIC_LASY_ATTRIBUTION ||
      'Źródło: Bank Danych o Lasach (BDL) – Program „Zanocuj w lesie”',
    category: 'Польша',
    subtitle: 'Программа Zanocuj w lesie',
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
    return { ...layer, url: layer.url.replace('{owmApiKey}', getOwmApiKey()) };
  }
  return layer;
};

export const getActiveOverlayLayers = (): WebMapLayerDefinition[] =>
  WEB_MAP_OVERLAY_LAYERS.filter((layer) => {
    if (!layer.requiresEnv) return true;
    return Boolean(readEnv(layer.requiresEnv));
  }).map(resolveLayerUrl);

export const WEB_MAP_BASE_LAYERS: WebMapLayerDefinition[] = [
  {
    id: 'osm',
    title: 'OpenStreetMap',
    kind: 'tile',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    defaultEnabled: true,
  },
];
