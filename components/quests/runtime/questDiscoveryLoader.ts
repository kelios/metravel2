import type { ImmutableRequest } from 'expo-server';
import { fetchPublicRouteJson, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { validateQuestDiscovery, type QuestDiscoveryView } from '@/utils/questDiscovery';
import { compactQuestDiscovery, type CompactQuestDiscovery } from '@/utils/questDiscoveryWire';

/** Loader data is serialized into the page HTML; rows travel in their compact form (#3234). */
export async function loadQuestDiscovery(request: ImmutableRequest | undefined, view: QuestDiscoveryView): Promise<CompactQuestDiscovery | null> {
  if (!request || process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR !== 'true') return null;
  return memoizePublicRouteData(request, `quest-discovery:${view}`, async () => {
    const raw = await fetchPublicRouteJson(request, `quests/web/discovery/?lang=ru&view=${view}`);
    const result = validateQuestDiscovery(raw, view);
    if (!result) throw publicRouteError(503);
    return compactQuestDiscovery(result);
  });
}
