export type LngLat = [number, number];

export interface RouteWaypoint {
  name?: string;
  description?: string;
  coordinates: LngLat;
}

export interface RouteExportInput {
  name?: string;
  description?: string;
  sourceName?: string;
  sourceUrl?: string;
  /** GPX `<metadata><author><name>` — автор маршрута. */
  author?: string;
  /**
   * GPX: дополнительно повторить waypoints в том же порядке как `<rte>/<rtept>`,
   * чтобы навигатор импортировал их как маршрут, а не как разрозненные точки.
   */
  includeRoute?: boolean;
  /** Route track coordinates in legacy Metravel format: [lng, lat] */
  track?: LngLat[];
  /** Optional waypoints (start/end or standalone points) */
  waypoints?: RouteWaypoint[];
  /** ISO datetime string; defaults to now */
  time?: string;
}

export interface RouteExportResult {
  content: string;
  mimeType: string;
  filename: string;
}
