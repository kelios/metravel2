export type WebMapLayerKind = 'tile' | 'wms' | 'osm-overpass-camping';

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
    id: 'lasy-camping',
    title: 'Польша: места палаток (Lasy Państwowe)',
    kind: 'wms',
    url: process.env.EXPO_PUBLIC_LASY_WMS_URL || '',
    attribution:
      process.env.EXPO_PUBLIC_LASY_ATTRIBUTION ||
      'Źródło: Lasy Państwowe – „Zanocuj w lesie”',
    wmsParams: {
      layers: process.env.EXPO_PUBLIC_LASY_WMS_LAYERS || 'miejsca_biwakowe',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
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
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    defaultEnabled: true,
  },
];
