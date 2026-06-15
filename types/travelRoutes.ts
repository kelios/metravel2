export interface TravelRouteFile {
  id: number;
  original_name: string;
  ext: string;
  size?: number;
  download_url?: string;
  created_at?: string | null;
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
