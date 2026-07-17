import { useEffect, useMemo, useState } from 'react';

import type { LngLat } from '@/utils/routeExport';
import {
  buildDirectQuestRouteResult,
  buildQuestWalkingRouteGeometry,
  calculateQuestTrackDistanceM,
  closeQuestRouteLoop,
  getQuestDirectRouteTrack,
  getQuestRoutePoints,
  type QuestRouteGeometryResult,
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
  options: { closeLoop?: boolean } = {},
): QuestRouteGeometryState {
  const { closeLoop = false } = options;
  // Кольцевой квест (тег `loop`): к точкам добавляется стартовая, чтобы роутер
  // проложил обратный сегмент «финиш → старт» и трек замкнулся.
  const points = useMemo(() => {
    const base = getQuestRoutePoints(steps);
    return closeLoop ? closeQuestRouteLoop(base) : base;
  }, [steps, closeLoop]);
  const pointsKey = useMemo(
    () => points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join('|'),
    [points],
  );

  const directTrack = useMemo(() => getQuestDirectRouteTrack(points), [points]);

  const [state, setState] = useState<QuestRouteGeometryState>(() => {
    if (directTrack.length < 2) return emptyState;
    const distanceM = calculateQuestTrackDistanceM(directTrack);
    return {
      status: 'loading',
      track: directTrack,
      source: 'direct',
      distanceM,
      durationS: 0,
    };
  });

  useEffect(() => {
    if (directTrack.length < 2) {
      setState(emptyState);
      return;
    }

    const directFallback = buildDirectQuestRouteResult(points);
    const loadingState: QuestRouteGeometryState = {
      ...directFallback,
      status: 'loading',
    };
    setState(loadingState);

    const isTestEnv = typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'test';
    if (isTestEnv) {
      setState({
        ...directFallback,
        status: 'fallback',
        error: i18nT('quests:components.quests.useQuestRouteGeometry.marshrutizatsiya_otklyuchena_v_testovoy_sred_8985ac7a'),
      });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    buildQuestWalkingRouteGeometry(points, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setState({
          ...result,
          status: result.source === 'routed' ? 'ready' : 'fallback',
        });
      })
      .catch((error) => {
        if (cancelled || error?.name === 'AbortError') return;
        setState({
          ...buildDirectQuestRouteResult(points, error),
          status: 'fallback',
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [directTrack, points, pointsKey]);

  return state;
}
