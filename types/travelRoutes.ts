export interface TravelRouteServerSummary {
  distanceKm: number | null;
  hasElevation: boolean;
  ascentM: number | null;
  descentM: number | null;
  minElevationM: number | null;
  maxElevationM: number | null;
  elevationRangeM: number | null;
  avgClimbMPerKm: number | null;
  startCoord: string | null;
  finishCoord: string | null;
  peakCoord: string | null;
}

export interface TravelRouteFile {
  id: number;
  original_name: string;
  ext: string;
  size?: number;
  download_url?: string;
  created_at?: string | null;
  /** Server-prepared route geometry/elevation (#699). Absent on old deployments. */
  preview?: ParsedRoutePreview | null;
  summary?: TravelRouteServerSummary | null;
}

export interface TravelRouteUploadInput {
  file: File | { uri: string; name: string; type?: string };
}

export interface ParsedRoutePoint {
  coord: string;
  elevation?: number | null;
}

export interface RouteElevationSample {
  distanceKm: number;
  elevationM: number;
  /** Marks a recording gap / teleport before this sample; ascent/descent must not accumulate across it. */
  gapBefore?: boolean;
}

export interface ParsedRoutePreview {
  linePoints: ParsedRoutePoint[];
  elevationProfile: RouteElevationSample[];
}
