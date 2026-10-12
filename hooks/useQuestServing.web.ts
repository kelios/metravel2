import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { fetchQuestServing } from '@/api/questServing';
import { validateQuestServingProjection, type QuestServingProjection } from '@/utils/questLocaleRouting';
import type { QuestServingOptions, QuestServingResult } from './questServingTypes';
import { useNetworkStatus } from './useNetworkStatus';

// A live result supersedes the document snapshot across SPA unmount/remounts.
const retiredBootstraps = new WeakSet<Element>();
// Pause for revalidation-only callers: the resolver could not establish a package
// identity (503 with release_id null) — before the release that is every request,
// after it a retryable failure — so RU revalidations pause instead of repeating the
// 503 on every SPA hop (#2364). A document bootstrap of the quest itself still
// revalidates.
const SERVING_IDENTITY_PAUSE_MS = 5 * 60_000;
let servingIdentityPausedUntil = 0;
export function resetQuestServingReleaseLatchForTests() { servingIdentityPausedUntil = 0; }

function parseQuestServingBootstrap(options: QuestServingOptions): { node: Element; projection: QuestServingProjection } | null {
  if (typeof document === 'undefined' || !options.cityId) return null;
  const node = document.getElementById('quest-serving-v1');
  if (node?.tagName !== 'SCRIPT' || node.getAttribute('type') !== 'application/json') return null;
  try {
    const projection = validateQuestServingProjection(JSON.parse(node.textContent || ''), {
      cityId: options.cityId, questSlug: options.questSlug, locale: options.locale,
    });
    return projection ? { node, projection } : null;
  } catch { return null; }
}

export function readQuestServingBootstrap(options: QuestServingOptions): QuestServingProjection | null {
  const parsed = parseQuestServingBootstrap(options);
  return parsed && !retiredBootstraps.has(parsed.node) ? parsed.projection : null;
}

export function useQuestServing(options: QuestServingOptions): QuestServingResult {
  const { cityId, questSlug, locale, enabled: requested, requireBootstrap = false } = options;
  const network = useNetworkStatus();
  const offline = !network.isConnected || network.isInternetReachable === false;
  // Revalidation-only callers (the RU page) keep querying on SPA entry — the
  // version links of a released quest depend on it — except during the identity
  // pause; a document carrying this quest's bootstrap (retired included) always
  // revalidates.
  const enabled = useMemo(() => requested && (!requireBootstrap || Date.now() >= servingIdentityPausedUntil
    || parseQuestServingBootstrap({ cityId, questSlug, locale, enabled: requested }) !== null),
  [requested, requireBootstrap, cityId, questSlug, locale]);
  const bootstrap = useMemo(() => readQuestServingBootstrap({ cityId, questSlug, locale, enabled }),
    [cityId, questSlug, locale, enabled]);
  const query = useQuery({
    queryKey: queryKeys.questServing(cityId, questSlug, locale),
    queryFn: async ({ signal }) => {
      const node = bootstrap && typeof document !== 'undefined'
        ? document.getElementById('quest-serving-v1') : null;
      try {
        const result = await fetchQuestServing({ cityId: cityId!, questSlug, locale }, signal);
        if (result.state === 'temporary_failure' && result.release_id === null) {
          servingIdentityPausedUntil = Date.now() + SERVING_IDENTITY_PAUSE_MS;
        }
        return result;
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
