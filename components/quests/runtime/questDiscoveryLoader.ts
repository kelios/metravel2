import type { ImmutableRequest } from 'expo-server';
import { fetchPublicRouteJson, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { validateQuestDiscovery, type QuestDiscoveryLocale, type QuestDiscoveryView } from '@/utils/questDiscovery';
import { compactQuestDiscovery, type CompactQuestDiscovery } from '@/utils/questDiscoveryWire';

/**
 * Loader data is serialized into the page HTML; rows travel in their compact form (#3234).
 * `locale` ≠ `ru` — the language hub `/{locale}/quests` (#3360): its members in its language.
 */
export async function loadQuestDiscovery(request: ImmutableRequest | undefined, view: QuestDiscoveryView,
  locale: QuestDiscoveryLocale = 'ru'): Promise<CompactQuestDiscovery | null> {
  if (!request || process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR !== 'true') return null;
  return memoizePublicRouteData(request, `quest-discovery:${locale}:${view}`, async () => {
    const raw = await fetchPublicRouteJson(request, `quests/web/discovery/?lang=${locale}&view=${view}`);
    const result = validateQuestDiscovery(raw, view, locale);
    if (!result) throw publicRouteError(503);
    return compactQuestDiscovery(result);
  });
}
