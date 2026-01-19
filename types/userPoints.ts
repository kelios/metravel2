export type PointColor = string;

export enum PointStatus {
  VISITED = 'visited',
  WANT_TO_VISIT = 'want_to_visit',
  PLANNING = 'planning',
  ARCHIVED = 'archived',
}

export interface ImportedPoint {
  id: number;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  color: string;
  category: string;
  status: PointStatus;
  source: 'google_maps' | 'osm';
  original_id?: string | null;
  imported_at: string;
  photos?: Record<string, unknown> | null;
  rating?: number | null;
  notes?: string | null;
  visited_date?: string | null;
  tags?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type DedupePolicy = 'merge' | 'skip' | 'duplicate';

export interface ImportPointsResult {
  importId: string;
  dedupePolicy: DedupePolicy;
  totalParsed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<Record<string, unknown>>;
}

export interface ParsedPoint {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  color: string;
  category: string;
  status: PointStatus;
  source: 'google_maps' | 'osm';
  originalId?: string;
  importedAt: string;
  rating?: number;
}

export interface PointFilters {
  colors?: string[];
  siteCategories?: string[];
  statuses?: PointStatus[];
  page?: number;
  perPage?: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  radius?: {
    center: { lat: number; lng: number };
    meters: number;
  };
  search?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  sortBy?: 'name' | 'date' | 'distance' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface RouteRequest {
  origin: {
    lat: number;
    lng: number;
    label?: string;
  };
  destinations: string[];
  transportMode: 'car' | 'bike' | 'foot' | 'transit';
  optimize?: boolean;
  maxDistance?: number;
  maxDuration?: number;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  coordinates: Array<{ lat: number; lng: number }>;
}

export interface RouteResponse {
  route: {
    points: Array<{ lat: number; lng: number }>;
    distance: number;
    duration: number;
    steps: RouteStep[];
  };
  waypoints: Array<{
    pointId: string;
    order: number;
    arrivalTime?: string;
    distanceFromPrevious: number;
    durationFromPrevious: number;
  }>;
  stats: {
    totalDistance: number;
    totalDuration: number;
    estimatedCost?: number;
  };
}

export interface RecommendationRequest {
  count: number;
  maxDistance?: number;
  maxDuration?: number;
  preferredColors?: string[];
  preferredCategories?: string[];
  excludeVisited?: boolean;
  currentLocation?: { lat: number; lng: number };
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  weather?: 'sunny' | 'rainy' | 'cloudy';
}

export interface RecommendationResponse {
  recommendations: Array<{
    point: ImportedPoint;
    score: number;
    reasons: string[];
    distance?: number;
    duration?: number;
  }>;
}

export interface UserPointsStats {
  total: number;
  byColor: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<PointStatus, number>;
  visited: number;
  toVisit: number;
  totalDistance: number;
  countriesVisited: number;
  citiesVisited: number;
}

export const STATUS_LABELS: Record<PointStatus, string> = {
  visited: 'Посещено',
  want_to_visit: 'Хочу посетить',
  planning: 'Планирую',
  archived: 'Архив'
};
