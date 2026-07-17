import { valhallaRoute } from '@/api/external/valhalla';
import { serverRoute } from '@/api/external/serverRouting';
import {
  decodePolyline6,
  ensureAnchoredGeometry,
  estimateDurationSeconds,
  filterValidCoords,
  haversineMeters,
  validateRoutePoints,
} from '@/utils/routingHelpers';
import type { LngLat } from '@/utils/routeExport';
import { translate as i18nT } from '@/i18n'


export type QuestRoutePoint = {
  lat: number;
  lng: number;
  title?: string;
  location?: string;
};

export type QuestRouteGeometrySource = 'routed' | 'direct';

export type QuestRouteGeometryResult = {
  track: LngLat[];
  source: QuestRouteGeometrySource;
  distanceM: number;
  durationS: number;
  provider?: 'server' | 'valhalla';
  error?: string;
};

export const getQuestRoutePoints = (steps: QuestRoutePoint[]) =>
  steps.filter(
    (step) =>
      Number.isFinite(step.lat) &&
      Number.isFinite(step.lng) &&
      step.lat >= -90 &&
      step.lat <= 90 &&
      step.lng >= -180 &&
      step.lng <= 180 &&
      (step.lat !== 0 || step.lng !== 0),
  );

export const getQuestDirectRouteTrack = (steps: QuestRoutePoint[]): LngLat[] =>
  getQuestRoutePoints(steps).map((step) => [step.lng, step.lat]);

// Финиш и старт кольца считаем «уже сомкнутыми», если они ближе этого порога —
// добавлять петлю-сегмент бессмысленно (маркеры и так рядом).
const LOOP_ALREADY_CLOSED_M = 50;

/**
 * Замыкает кольцевой маршрут: добавляет стартовую точку в конец списка, чтобы
 * роутер проложил обратный сегмент «последняя точка → старт». Точка-дубль
 * участвует только в построении трека — маркеры шагов рисуются из исходного
 * списка у вызывающих.
 */
export const closeQuestRouteLoop = (steps: QuestRoutePoint[]): QuestRoutePoint[] => {
  const points = getQuestRoutePoints(steps);
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const gapM = haversineMeters([first.lng, first.lat], [last.lng, last.lat]);
  if (gapM <= LOOP_ALREADY_CLOSED_M) return points;
  return [...points, { lat: first.lat, lng: first.lng }];
};

export const calculateQuestTrackDistanceM = (track: LngLat[]): number => {
  const valid = filterValidCoords(track);
  if (valid.length < 2) return 0;

  return valid.reduce((sum, point, index) => {
    if (index === 0) return 0;
    return sum + haversineMeters(valid[index - 1], point);
  }, 0);
};

export const buildDirectQuestRouteResult = (
  steps: QuestRoutePoint[],
  error?: unknown,
): QuestRouteGeometryResult => {
  const track = getQuestDirectRouteTrack(steps);
  const distanceM = calculateQuestTrackDistanceM(track);
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;

  return {
    track,
    source: 'direct',
    distanceM,
    durationS: estimateDurationSeconds(distanceM, 'foot'),
    error: message,
  };
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

const throwForRouteStatus = async (res: Response, provider: string): Promise<void> => {
  const text = await res.text().catch(() => '');
  if (res.status === 429) throw new Error(i18nT('quests:components.quests.questRouteGeometry.prevyshen_limit_marshrutizatsii_poprobuyte_p_88fedb13'));
  if (res.status === 400) throw new Error(i18nT('quests:components.quests.questRouteGeometry.nekorrektnye_koordinaty_marshruta_ae9ee4d5'));
  throw new Error(i18nT('quests:components.quests.questRouteGeometry.oshibka_value1_value2_value3_02ee40f2', { value1: provider, value2: res.status, value3: text ? ` - ${text}` : '' }));
};

const normalizeTrack = (value: unknown): LngLat[] => {
  if (!Array.isArray(value)) return [];
  return filterValidCoords(
    value
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        return [Number(point[0]), Number(point[1])] as LngLat;
      })
      .filter((point): point is LngLat => Array.isArray(point)),
  );
};

const buildServerRoute = async (
  points: QuestRoutePoint[],
  signal?: AbortSignal,
): Promise<QuestRouteGeometryResult> => {
  const waypoints = points.map((point) => [point.lng, point.lat] as LngLat);
  validateRoutePoints(waypoints);

  const res = await serverRoute(
    points.map((point) => ({ lat: point.lat, lng: point.lng })),
    'foot',
    { signal },
  );
  if (!res.ok) await throwForRouteStatus(res, i18nT('quests:components.quests.questRouteGeometry.servera_marshrutizatsii_9da8dfea'));

  const data = await res.json();
  const track = ensureAnchoredGeometry(waypoints, normalizeTrack(data?.geometry));
  if (track.length < 2) throw new Error(i18nT('quests:components.quests.questRouteGeometry.pustoy_peshiy_marshrut_ot_servera_cbf4445a'));

  const distanceM = Number(data?.distance_m) || calculateQuestTrackDistanceM(track);
  const durationS = Number(data?.duration_s) || estimateDurationSeconds(distanceM, 'foot');

  return {
    track,
    source: 'routed',
    provider: 'server',
    distanceM,
    durationS,
  };
};

const buildValhallaRoute = async (
  points: QuestRoutePoint[],
  signal?: AbortSignal,
): Promise<QuestRouteGeometryResult> => {
  const waypoints = points.map((point) => [point.lng, point.lat] as LngLat);
  validateRoutePoints(waypoints);

  const res = await valhallaRoute(
    {
      locations: points.map((point) => ({ lat: point.lat, lon: point.lng })),
      costing: 'pedestrian',
      directions_options: { units: 'kilometers' },
    },
    { signal },
  );
  if (!res.ok) await throwForRouteStatus(res, 'Valhalla');

  const data = await res.json();
  const legs = Array.isArray(data?.trip?.legs) ? data.trip.legs : [];
  const decodedTrack = legs.flatMap((leg: any) =>
    typeof leg?.shape === 'string' ? decodePolyline6(leg.shape) : [],
  );
  const track = ensureAnchoredGeometry(waypoints, filterValidCoords(decodedTrack));
  if (track.length < 2) throw new Error(i18nT('quests:components.quests.questRouteGeometry.pustoy_peshiy_marshrut_ot_valhalla_9e4a0a35'));

  const distanceM = Number(data?.trip?.summary?.length) > 0
    ? Number(data.trip.summary.length) * 1000
    : calculateQuestTrackDistanceM(track);
  const durationS = Number(data?.trip?.summary?.time) || estimateDurationSeconds(distanceM, 'foot');

  return {
    track,
    source: 'routed',
    provider: 'valhalla',
    distanceM,
    durationS,
  };
};

export async function buildQuestWalkingRouteGeometry(
  steps: QuestRoutePoint[],
  init: { signal?: AbortSignal } = {},
): Promise<QuestRouteGeometryResult> {
  const points = getQuestRoutePoints(steps);
  if (points.length < 2) return buildDirectQuestRouteResult(points);

  let lastError: unknown;

  try {
    return await buildServerRoute(points, init.signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    lastError = error;
  }

  try {
    return await buildValhallaRoute(points, init.signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    lastError = error;
  }

  return buildDirectQuestRouteResult(points, lastError);
}
