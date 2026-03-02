// components/map-core/types.ts
// C1: Unified map contract — single source of truth for all map types
// Both `components/map/` and `components/MapPage/` should migrate to these types.

// ---------------------------------------------------------------------------
// Marker / Point types
// ---------------------------------------------------------------------------

/** Canonical map marker — used by both map stacks */
export interface MapMarker {
  /** Unique identifier (travel ID, point index, etc.) */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Display label / tooltip */
  label?: string;
  /** Full address string */
  address?: string;
  /** Thumbnail URL for popup */
  imageUrl?: string;
  /** Category name for icon coloring */
  categoryName?: string;
  /** Category IDs for filtering */
  categoryIds?: Array<string | number>;
  /** Link to travel detail page */
  travelUrl?: string;
  /** Link to article */
  articleUrl?: string;
  /** Custom marker icon key */
  iconKey?: string;
  /** Point update timestamp */
  updatedAt?: string;
}

/** Legacy point format — for backward compatibility during migration */
export interface LegacyMapPoint {
  id?: string | number;
  coord: string;
  address: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  category?: string | number | Array<string | { name?: string }>;
  categoryId?: string | number;
  category_id?: string | number;
  categoryIds?: Array<string | number>;
  category_ids?: Array<string | number>;
  categories?: Array<string | number | Record<string, unknown>>;
  articleUrl?: string;
  urlTravel?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Map view state
// ---------------------------------------------------------------------------

export interface MapViewState {
  /** Map center latitude */
  centerLat: number;
  /** Map center longitude */
  centerLng: number;
  /** Zoom level */
  zoom: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type TransportMode = 'car' | 'bike' | 'foot';
export type MapMode = 'radius' | 'route';

export interface RouteSegment {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
}

export interface RouteState {
  waypoints: [number, number][];
  fullCoords: [number, number][];
  distance: number;
  duration: number;
  elevationGain: number | null;
  elevationLoss: number | null;
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------

export interface MapPopupProps {
  marker: MapMarker;
  onClose?: () => void;
  onNavigate?: (url: string) => void;
}

// ---------------------------------------------------------------------------
// Cluster
// ---------------------------------------------------------------------------

export interface MapClusterData {
  key: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  items: MapMarker[];
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

export interface MapEventHandlers {
  onMapClick?: (lng: number, lat: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  onViewChange?: (state: MapViewState) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onUserLocationChange?: (location: Coordinates | null) => void;
}

// ---------------------------------------------------------------------------
// Map component props (unified)
// ---------------------------------------------------------------------------

export interface MapCoreProps {
  markers: MapMarker[];
  viewState?: MapViewState;
  mode?: MapMode;
  transportMode?: TransportMode;
  routeState?: RouteState;
  radius?: number;
  compact?: boolean;
  height?: number;
  enableClustering?: boolean;
  enableOverlays?: boolean;
  handlers?: MapEventHandlers;
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/** Parse "lat, lng" or "lat,lng" string into coordinates */
export const parseCoordString = (coord: string): { lat: number; lng: number } | null => {
  if (!coord) return null;
  const parts = coord.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

/** Convert a LegacyMapPoint to a MapMarker */
export const legacyPointToMarker = (point: LegacyMapPoint, index: number): MapMarker | null => {
  const id = point.id != null && String(point.id).trim()
    ? String(point.id)
    : `idx-${index}`;

  const coords = parseCoordString(point.coord);
  if (!coords) return null;

  // Normalize categoryName from complex union to string
  let categoryName: string | undefined;
  if (typeof point.categoryName === 'string') {
    categoryName = point.categoryName;
  } else if (point.categoryName && typeof point.categoryName === 'object' && !Array.isArray(point.categoryName)) {
    categoryName = point.categoryName.name;
  }

  // Merge categoryIds from various sources
  const categoryIds: Array<string | number> = [
    ...(point.categoryIds ?? []),
    ...(point.category_ids ?? []),
    ...(point.categoryId != null ? [point.categoryId] : []),
    ...(point.category_id != null ? [point.category_id] : []),
  ];

  return {
    id,
    lat: coords.lat,
    lng: coords.lng,
    address: point.address || undefined,
    imageUrl: point.travelImageThumbUrl,
    categoryName,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    travelUrl: point.urlTravel,
    articleUrl: point.articleUrl,
    updatedAt: point.updated_at,
  };
};

/**
 * Backward-compatible alias for LegacyMapPoint.
 * Consumers that used `import { Point } from '...'` can use this instead.
 */
export type Point = LegacyMapPoint;

/**
 * Normalize any raw input into a LegacyMapPoint (for bridge during migration).
 * This consolidates the inline normalizePoint() that lived in map/Map.web.tsx.
 */
export const normalizePoint = (input: unknown, index: number): LegacyMapPoint => {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {} as Record<string, unknown>;

  const id =
    raw.id !== undefined && raw.id !== null && String(raw.id).trim().length > 0
      ? String(raw.id)
      : `idx-${index}`;

  const lat = typeof raw.lat === 'number' ? raw.lat : Number(raw.lat);
  const lng = typeof raw.lng === 'number' ? raw.lng : Number(raw.lng);

  const coord =
    typeof raw.coord === 'string' && (raw.coord as string).trim()
      ? (raw.coord as string).trim()
      : typeof raw.coords === 'string' && (raw.coords as string).trim()
        ? (raw.coords as string).trim()
        : Number.isFinite(lat) && Number.isFinite(lng)
          ? `${lat}, ${lng}`
          : '';

  const address =
    typeof raw.address === 'string' && (raw.address as string).trim()
      ? (raw.address as string).trim()
      : typeof raw.name === 'string' && (raw.name as string).trim()
        ? (raw.name as string).trim()
        : '';

  return {
    id,
    coord,
    address,
    travelImageThumbUrl:
      (raw.travelImageThumbUrl as string) ??
      (raw.travel_image_thumb_url as string) ??
      (raw.image as string) ??
      undefined,
    updated_at: raw.updated_at as string | undefined,
    categoryName: (raw.categoryName ?? raw.category_name) as LegacyMapPoint['categoryName'],
    category: raw.category as LegacyMapPoint['category'],
    categoryId: (raw.categoryId ?? raw.category_id) as string | number | undefined,
    category_id: (raw.category_id ?? raw.categoryId) as string | number | undefined,
    categoryIds: (raw.categoryIds ?? raw.category_ids) as Array<string | number> | undefined,
    category_ids: (raw.category_ids ?? raw.categoryIds) as Array<string | number> | undefined,
    categories: (raw.categories ?? raw.categoryIds ?? raw.category_ids) as LegacyMapPoint['categories'],
    articleUrl: (raw.articleUrl ?? raw.article_url) as string | undefined,
    urlTravel: (raw.urlTravel ?? raw.url_travel ?? raw.url) as string | undefined,
  };
};


