import type { ImmutableRequest } from 'expo-server';
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { parseQuestPublicRoute, validateQuestPublicProjection, type QuestPublicProjection } from '@/utils/questPublicPage';

/**
 * #2896: публикация ответила 404/410 на клиентский запрос данных маршрута.
 * Документ на такой адрес сервер по-прежнему отдаёт кодом 404 (nginx кладёт
 * поверх него оболочку `+not-found.html`), а вот клиентский переход — после
 * гидратации этой оболочки или по ссылке — expo-router делает отдельным запросом
 * `/_expo/loaders/...`: брошенный там 404 превращался в
 * `Failed to load loader data for route` и экран ошибки/пустоту вместо страницы
 * «Квест не найден». Маркер отдаёт экрану факт «нет такого адреса» данными.
 */
export type QuestRouteNotFound = { kind: 'not_found'; path: string; httpStatus: 404 | 410 };

export type QuestRouteLoaderPayload = QuestPublicProjection | QuestRouteNotFound | null;

export function isQuestRouteNotFound(data: unknown): data is QuestRouteNotFound {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'not_found';
}

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
