import { useEffect, useMemo, useState } from 'react';

import type { LngLat } from '@/utils/routeExport';
import {
  buildDirectQuestRouteResult,
  buildQuestRouteGeometry,
  calculateQuestTrackDistanceM,
  closeQuestRouteLoop,
  getQuestDirectRouteTrack,
  getQuestRoutePoints,
  type QuestRouteGeometryResult,
  type QuestRouteMode,
  type QuestRoutePoint,
} from './questRouteGeometry';
import { translate as i18nT } from '@/i18n'


export type QuestRouteGeometryState = QuestRouteGeometryResult & {
  status: 'idle' | 'loading' | 'ready' | 'fallback';
};

const emptyState: QuestRouteGeometryState = {
  status: 'idle',
  track: [],
  source: 'direct',
  distanceM: 0,
  durationS: 0,
};

export const hasRoutedQuestTrack = (track?: LngLat[], source?: string) =>
  source === 'routed' && Array.isArray(track) && track.length >= 2;

export function useQuestRouteGeometry(
  steps: QuestRoutePoint[],
  options: { closeLoop?: boolean; routeMode?: QuestRouteMode; enabled?: boolean } = {},
): QuestRouteGeometryState {
  const { closeLoop = false, routeMode = 'foot', enabled = true } = options;
  // Кольцевой квест (тег `loop`): к точкам добавляется стартовая, чтобы роутер
  // проложил обратный сегмент «финиш → старт» и трек замкнулся.
  const validPoints = getQuestRoutePoints(steps);
  const routePoints = closeLoop ? closeQuestRouteLoop(validPoints) : validPoints;
  // Only coordinates affect routing. A metadata refresh may recreate the
  // steps array without changing the route; retain the point identity then.
  const pointsKey = JSON.stringify(routePoints.map(({ lat, lng }) => [lat, lng]));
  const points = useMemo(
    () => (JSON.parse(pointsKey) as [number, number][]).map(([lat, lng]) => ({ lat, lng })),
    [pointsKey],
  );

  const directTrack = useMemo(() => getQuestDirectRouteTrack(points), [points]);
  const routeKey = `${enabled ? 'enabled' : 'disabled'}:${routeMode}:${pointsKey}`;

  const initialState = (): QuestRouteGeometryState => {
    if (!enabled || directTrack.length < 2) return emptyState;
    const distanceM = calculateQuestTrackDistanceM(directTrack);
    return {
      status: 'loading',
      track: directTrack,
      source: 'direct',
      distanceM,
      durationS: 0,
    };
  };
  const [state, setState] = useState<{ key: string; route: QuestRouteGeometryState }>(() => ({
    key: routeKey,
    route: initialState(),
  }));

  useEffect(() => {
    if (!enabled || directTrack.length < 2) {
      setState({ key: routeKey, route: emptyState });
      return;
    }

    const directFallback = buildDirectQuestRouteResult(points, { routeMode });
    const loadingState: QuestRouteGeometryState = {
      ...directFallback,
      status: 'loading',
    };
    setState({ key: routeKey, route: loadingState });

    const isTestEnv = typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'test';
    if (isTestEnv) {
      setState({ key: routeKey, route: {
        ...directFallback,
        status: 'fallback',
        error: i18nT('quests:components.quests.useQuestRouteGeometry.marshrutizatsiya_otklyuchena_v_testovoy_sred_8985ac7a'),
      } });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    buildQuestRouteGeometry(points, { signal: controller.signal, routeMode })
      .then((result) => {
        if (cancelled) return;
        setState({ key: routeKey, route: {
          ...result,
          status: result.source === 'routed' ? 'ready' : 'fallback',
        } });
      })
      .catch((error) => {
        if (cancelled || error?.name === 'AbortError') return;
        setState({ key: routeKey, route: {
          ...buildDirectQuestRouteResult(points, { error, routeMode }),
          status: 'fallback',
        } });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [directTrack, points, routeMode, enabled, routeKey]);

  // Effects run after render. Never briefly expose a previous quest/mode's
  // distance or track while the new route is being calculated.
  return state.key === routeKey ? state.route : initialState();
}
