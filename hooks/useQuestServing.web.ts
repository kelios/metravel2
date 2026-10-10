import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { fetchQuestServing } from '@/api/questServing';
import { validateQuestServingProjection, type QuestServingProjection } from '@/utils/questLocaleRouting';
import type { QuestServingOptions, QuestServingResult } from './questServingTypes';
import { useNetworkStatus } from './useNetworkStatus';

// A live result supersedes the document snapshot across SPA unmount/remounts.
const retiredBootstraps = new WeakSet<Element>();

export function readQuestServingBootstrap(options: QuestServingOptions): QuestServingProjection | null {
  if (typeof document === 'undefined' || !options.cityId) return null;
  const node = document.getElementById('quest-serving-v1');
  if (node?.tagName !== 'SCRIPT' || node.getAttribute('type') !== 'application/json'
    || retiredBootstraps.has(node)) return null;
  try {
    return validateQuestServingProjection(JSON.parse(node.textContent || ''), {
      cityId: options.cityId, questSlug: options.questSlug, locale: options.locale,
    });
  } catch { return null; }
}

export function useQuestServing(options: QuestServingOptions): QuestServingResult {
  const { cityId, questSlug, locale, enabled } = options;
  const network = useNetworkStatus();
  const offline = !network.isConnected || network.isInternetReachable === false;
  const bootstrap = useMemo(() => readQuestServingBootstrap({ cityId, questSlug, locale, enabled }),
    [cityId, questSlug, locale, enabled]);
  const query = useQuery({
    queryKey: queryKeys.questServing(cityId, questSlug, locale),
    queryFn: async ({ signal }) => {
      const node = bootstrap && typeof document !== 'undefined'
        ? document.getElementById('quest-serving-v1') : null;
      try {
        return await fetchQuestServing({ cityId: cityId!, questSlug, locale }, signal);
      } finally {
        if (node && !signal.aborted) retiredBootstraps.add(node);
      }
    },
    enabled: enabled && !offline && Boolean(cityId && questSlug),
    // Never use persistent/offline query data as proof of publication.
    networkMode: 'always', staleTime: 0, gcTime: 0, retry: false,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always',
  });
  let projection = query.isFetchedAfterMount ? query.data ?? null : bootstrap;
  if (query.error && enabled && cityId) {
    projection = {
      schema_version: 1, release_id: null, city_id: cityId, quest_slug: questSlug, locale,
      state: 'temporary_failure', canonical_path: null, versions: [],
      ru_source_path: projection?.ru_source_path ?? null,
    };
  }
  return { projection: enabled && !offline ? projection : null, offline,
    pending: enabled && !offline && !projection && !query.error,
    refetch: () => { void query.refetch(); } };
}
