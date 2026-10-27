import type { ImmutableRequest } from 'expo-server';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { parseQuestPublicRoute, validateQuestPublicProjection, type QuestPublicProjection } from '@/utils/questPublicPage';

export type QuestRouteLoaderPayload = QuestPublicProjection | null;

export function resolveQuestLoaderPath(params: Record<string, string | string[]>): string | null {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  if (params.missing) return '/' + ([] as string[]).concat(params.missing).join('/');
  const country = first(params.country);
  if (country) return `/quests/country/${country}`;
  const city = first(params.city), slug = first(params.questId);
  return city ? `/quests/${city}${slug ? '/' + slug : ''}` : null;
}

export async function loadQuestPublicRoute(request: ImmutableRequest | undefined,
  params: Record<string, string | string[]>): Promise<QuestRouteLoaderPayload> {
  if (!request || process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR !== 'true') return null;
  const path = resolveQuestLoaderPath(params);
  const route = path && parseQuestPublicRoute(path);
  if (!route) return null; // Other catch-all addresses retain their existing not-found owner.
  return memoizePublicRouteData(request, `quest-public:${route.path}`, async () => {
    const selected = route.kind === 'detail'
      ? `detail/${encodeURIComponent(route.city!)}/${encodeURIComponent(route.slug!)}`
      : route.kind === 'city' ? `city/${encodeURIComponent(route.city!)}` : `country/${encodeURIComponent(route.country!)}`;
    const raw = await fetchPublicRouteJson(request, `quests/web/${selected}/?lang=${route.locale}`);
    const projection = validateQuestPublicProjection(raw, route);
    if (!projection) throw Object.assign(new Error('Service Unavailable'), { httpStatus: 503 });
    return projection;
  });
}
