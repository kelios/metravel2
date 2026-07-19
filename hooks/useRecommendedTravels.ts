// FE-ARCH D1 #994 — рекомендации пользователя на React Query.
// Заменяет stores/recommendationsStore.ts (ручной _fetched/_userId кэш-движок +
// AsyncStorage-мирор). Ключ scoped по userId (identity-isolation: гость/userA/
// userB не делят кэш), офлайн держится на persistQueryClient (whitelist
// 'recommendations' в utils/queryPersist.ts, #1015), а не на ручном мироре.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/api/queryKeys';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { fetchUserRecommendedTravels } from '@/api/user';
import { normalizeServerTravelCards } from '@/utils/normalizeServerTravelItem';
import type { FavoriteItem } from '@/hooks/useFavoritesData';

const EMPTY: FavoriteItem[] = [];

const toFavoriteItems = (dto: unknown): FavoriteItem[] =>
  normalizeServerTravelCards(dto).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    url: n.url,
    imageUrl: n.imageUrl,
    addedAt: n.timestamp,
    country: n.country,
  }));

/**
 * Рекомендованные путешествия текущего пользователя. Возвращает `[]` для гостя
 * (запрос выключен) и до первой загрузки. Запрос лениво стартует у того, кто
 * реально показывает рекомендации (PersonalizedRecommendations), поэтому
 * не бьёт по сети на страницах, где рекомендаций нет.
 */
export function useRecommendedTravels(): FavoriteItem[] {
  const { isAuthenticated, userId } = useAuth();
  const scopedUserId = userId ?? null;

  const { data } = useQuery({
    queryKey: queryKeys.recommendations(scopedUserId),
    queryFn: async () => {
      const items = toFavoriteItems(await fetchUserRecommendedTravels(userId as string));
      // Сервер эпизодически отдаёт пустой ответ там, где данные есть; не затираем
      // уже показанные (в т.ч. восстановленные из persist) рекомендации пустотой
      // — так же, как это делал старый стор (recommended.length === 0 guard).
      if (items.length === 0) {
        const prev = getActiveQueryClient()?.getQueryData<FavoriteItem[]>(
          queryKeys.recommendations(scopedUserId),
        );
        if (prev && prev.length > 0) return prev;
      }
      return items;
    },
    enabled: isAuthenticated && !!userId,
  });

  return data ?? EMPTY;
}
