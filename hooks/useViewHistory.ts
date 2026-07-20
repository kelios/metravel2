// FE-ARCH D1 #994 — «недавно просмотренные» на React Query.
// Заменяет stores/viewHistoryStore.ts (ручной _fetched/_userId + loadLocal/
// loadServerCached/refreshFromServer/ensureServerData/resetFetchState + два
// AsyncStorage-ключа). Теперь единый источник — RQ-кэш queryKeys.viewHistory(userId),
// офлайн держит persistQueryClient (whitelist 'view-history', #1015).
//
// Семантика сохранена:
//  - список локально-first: addToHistory пишет в кэш (не на сервер), сервер
//    /history/ только догружается лениво (ensureServerData/refresh) и мержится;
//  - identity-isolation: ключ scoped по userId (гость=null отдельный список);
//  - MAX 50, дедуп по type:id (оставляем свежайший), сорт по viewedAt desc;
//  - «не затирать непустой список пустым ответом сервера».

import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/api/queryKeys';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { fetchUserHistory, clearUserHistory } from '@/api/user';
import { normalizeServerTravelCards } from '@/utils/normalizeServerTravelItem';

export type ViewHistoryItem = {
  id: string | number;
  type: 'travel' | 'article';
  title: string;
  imageUrl?: string;
  url: string;
  viewedAt: number;
  country?: string;
  city?: string;
};

const MAX_HISTORY_ITEMS = 50;
const EMPTY: ViewHistoryItem[] = [];

const getHistoryIdentity = (item: Pick<ViewHistoryItem, 'id' | 'type'>): string =>
  `${item.type}:${String(item.id)}`;

/** Дедуп по type:id (свежайший viewedAt), сорт по убыванию, срез до 50. */
export const mergeHistoryItems = (items: ViewHistoryItem[]): ViewHistoryItem[] => {
  const byIdentity = new Map<string, ViewHistoryItem>();
  for (const item of items) {
    const key = getHistoryIdentity(item);
    const existing = byIdentity.get(key);
    if (!existing || item.viewedAt > existing.viewedAt) {
      byIdentity.set(key, item);
    }
  }
  return Array.from(byIdentity.values())
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, MAX_HISTORY_ITEMS);
};

const normalizeServerHistory = (dto: unknown): ViewHistoryItem[] =>
  normalizeServerTravelCards(dto).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    url: n.url,
    imageUrl: n.imageUrl,
    viewedAt: n.timestamp,
    country: n.country,
  }));

const readCache = (client: QueryClient | null, userId: string | null): ViewHistoryItem[] =>
  client?.getQueryData<ViewHistoryItem[]>(queryKeys.viewHistory(userId)) ?? [];

/**
 * queryFn для истории. Гость — просто текущий (нормализованный) кэш; авторизованный
 * — GET /history/ смержённый с текущим локальным списком, с сохранением непустого
 * при пустом ответе сервера. Ошибку сервера пробрасываем: RQ оставит прошлые data
 * и повторит на следующем ensureServerData (эквивалент старого «не помечать fetched»).
 */
export const viewHistoryQueryFn =
  (userId: string | null) => async (): Promise<ViewHistoryItem[]> => {
    const current = readCache(getActiveQueryClient(), userId);
    if (!userId) return mergeHistoryItems(current);

    const server = normalizeServerHistory(await fetchUserHistory(userId));
    // Сервер отдаёт только travel-историю; локально могут быть статьи и свежий
    // просмотр до синка. Мержим, но не затираем непустое пустым ответом.
    return server.length === 0 && current.length > 0
      ? current
      : mergeHistoryItems([...server, ...current]);
  };

/**
 * Реактивное чтение истории. enabled:false — авто-фетча нет: список наполняют
 * addToHistory (локально) и ленивый ensureViewHistoryServerData; так сохраняется
 * прежняя ленивость (сервер дёргается только на History/Recommendations, а не на
 * каждой карточке с сердечком).
 */
export function useViewHistory(): ViewHistoryItem[] {
  const { userId } = useAuth();
  const scopedUserId = userId ?? null;
  const { data } = useQuery({
    queryKey: queryKeys.viewHistory(scopedUserId),
    queryFn: viewHistoryQueryFn(scopedUserId),
    enabled: false,
  });
  return data ?? EMPTY;
}

/** Локальная запись просмотра (без серверной мутации — как в старом сторе). */
export async function addViewHistoryItem(
  userId: string | null,
  item: Omit<ViewHistoryItem, 'viewedAt'>,
): Promise<void> {
  const client = getActiveQueryClient();
  if (!client) return;
  const key = queryKeys.viewHistory(userId);
  const current = client.getQueryData<ViewHistoryItem[]>(key) ?? [];
  const merged = mergeHistoryItems([{ ...item, viewedAt: Date.now() }, ...current]);
  client.setQueryData(key, merged);
}

/** Очистка истории: авторизованному — серверный DELETE, затем пустой кэш. */
export async function clearViewHistory(userId: string | null): Promise<void> {
  const client = getActiveQueryClient();
  if (userId) {
    await clearUserHistory(userId);
  }
  client?.setQueryData(queryKeys.viewHistory(userId), []);
}

/**
 * Ленивый догруз серверной истории (замена ensureServerData('history')).
 * staleTime 5м делает повторные вызовы в этом окне no-op'ом — эквивалент старого
 * `_fetched`-гварда «фетчить один раз на userId», но без ручного флага.
 */
export async function ensureViewHistoryServerData(userId: string | null): Promise<void> {
  const client = getActiveQueryClient();
  if (!client || !userId) return;
  await client.fetchQuery({
    queryKey: queryKeys.viewHistory(userId),
    queryFn: viewHistoryQueryFn(userId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Принудительный refetch (pull-to-refresh на History). */
export async function refreshViewHistory(userId: string | null): Promise<void> {
  const client = getActiveQueryClient();
  if (!client || !userId) return;
  await client.fetchQuery({
    queryKey: queryKeys.viewHistory(userId),
    queryFn: viewHistoryQueryFn(userId),
    staleTime: 0,
  });
}
