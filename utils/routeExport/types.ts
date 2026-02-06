export type LngLat = [number, number];

export interface RouteWaypoint {
  name?: string;
  coordinates: LngLat;
}

export interface RouteExportInput {
  name?: string;
  description?: string;
  /** Route track coordinates in legacy Metravel format: [lng, lat] */
  track: LngLat[];
  /** Optional waypoints (start/end) */
  waypoints?: RouteWaypoint[];
  /** ISO datetime string; defaults to now */
  time?: string;
}

export interface RouteExportResult {
  content: string;
  mimeType: string;
  filename: string;
}
