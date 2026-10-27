import type { ImmutableRequest } from 'expo-server';
import { fetchPublicRouteJson, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { validateQuestDiscovery, type QuestDiscovery, type QuestDiscoveryView } from '@/utils/questDiscovery';

export async function loadQuestDiscovery(request: ImmutableRequest | undefined, view: QuestDiscoveryView): Promise<QuestDiscovery | null> {
  if (!request || process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR !== 'true') return null;
  return memoizePublicRouteData(request, `quest-discovery:${view}`, async () => {
    const raw = await fetchPublicRouteJson(request, `quests/web/discovery/?lang=ru&view=${view}`);
    const result = validateQuestDiscovery(raw, view);
    if (!result) throw publicRouteError(503);
    return result;
  });
}
