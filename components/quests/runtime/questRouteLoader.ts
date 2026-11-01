import type { ImmutableRequest } from 'expo-server';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { parseQuestPublicRoute, validateQuestPublicProjection, type QuestPublicProjection } from '@/utils/questPublicPage';

import type { QuestRouteNotFound } from './questRouteNotFound';

export { isQuestRouteNotFound, type QuestRouteNotFound } from './questRouteNotFound';

export type QuestRouteLoaderPayload = QuestPublicProjection | QuestRouteNotFound | null;

/**
 * Клиентский запрос данных маршрута: expo-router шлёт его с `Accept:
 * application/json` (`expo-router/build/loaders/utils.js`), документ браузер
 * просит как `text/html`. Сервер переписывает путь `/_expo/loaders/<route>` в
 * путь маршрута до вызова loader'а, поэтому отличить запросы можно только так.
 */
export function isClientLoaderDataRequest(request: Pick<ImmutableRequest, 'headers'> | undefined): boolean {
  const accept = request?.headers?.get?.('accept') ?? '';
  return /\bapplication\/json\b/i.test(accept) && !/\btext\/html\b/i.test(accept);
}

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
    let raw: unknown;
    try {
      raw = await fetchPublicRouteJson(request, `quests/web/${selected}/?lang=${route.locale}`);
    } catch (error) {
      const httpStatus = (error as { httpStatus?: number } | null)?.httpStatus;
      if ((httpStatus === 404 || httpStatus === 410) && isClientLoaderDataRequest(request)) {
        return { kind: 'not_found', path: route.path, httpStatus } satisfies QuestRouteNotFound;
      }
      throw error;
    }
    const projection = validateQuestPublicProjection(raw, route);
    if (!projection) throw Object.assign(new Error('Service Unavailable'), { httpStatus: 503 });
    return projection;
  });
}
