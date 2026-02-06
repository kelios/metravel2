export type WebMapLayerKind =
  | 'tile'
  | 'wms'
  | 'osm-overpass-camping'
  | 'osm-overpass-poi'
  | 'osm-overpass-routes'
  | 'wfs-geojson';

export interface WebMapLayerDefinition {
  id: string;
  title: string;
  kind: WebMapLayerKind;
  /** XYZ template for tile layers OR base URL for WMS */
  url: string;
  attribution?: string;
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
  };
  opacity?: number;
  minZoom?: number;
  maxZoom?: number;
  zIndex?: number;
  defaultEnabled?: boolean;
}

/**
 * Web-only overlay layers.
 *
 * Важно: URL для Lasy Państwowe / «miejsca biwakowe» зависит от публичного сервиса.
 * Я добавил плейсхолдеры через env, чтобы можно было включить без правок кода.
 */
export const WEB_MAP_OVERLAY_LAYERS: WebMapLayerDefinition[] = [
  {
    id: 'waymarked-hiking',
    title: 'Маршруты (Waymarked Trails: hiking)',
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
    opacity: 0.95,
    zIndex: 520,
    defaultEnabled: false,
  },
  {
    id: 'waymarked-cycling',
    title: 'Маршруты (Waymarked Trails: cycling)',
    kind: 'tile',
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    attribution: '© waymarkedtrails.org, © OpenStreetMap contributors (ODbL)',
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
    opacity: 1,
    zIndex: 500,
    defaultEnabled: false,
  },
  {
    id: 'osm-poi',
    title: 'Достопримечательности (OSM)',
    kind: 'osm-overpass-poi',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    opacity: 1,
    zIndex: 480,
    defaultEnabled: false,
  },
  {
    id: 'osm-routes',
    title: 'Маршруты (OSM: hiking/bicycle)',
    kind: 'osm-overpass-routes',
    url: '',
    attribution: '© OpenStreetMap contributors (ODbL)',
    opacity: 1,
    zIndex: 470,
    defaultEnabled: false,
  },
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
    wfsParams: {
      typeName:
        process.env.EXPO_PUBLIC_LASY_WFS_TYPENAME ||
        'WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie',
      version: process.env.EXPO_PUBLIC_LASY_WFS_VERSION || '2.0.0',
      outputFormat: process.env.EXPO_PUBLIC_LASY_WFS_OUTPUT || 'GEOJSON',
      srsName: process.env.EXPO_PUBLIC_LASY_WFS_SRS || 'EPSG:4326',
    },
    opacity: 0.8,
    zIndex: 450,
    defaultEnabled: false,
  },
];

export const WEB_MAP_BASE_LAYERS: WebMapLayerDefinition[] = [
  {
    id: 'osm',
    title: 'OpenStreetMap',
    kind: 'tile',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    defaultEnabled: true,
  },
];
