import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/queryKeys';
import { userPointsApi } from '@/api/userPoints';
import { USER_POINTS_COLLECTION_STALE_TIME_MS } from '@/components/UserPoints/userPointPin';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import type { UserPointPin } from '@/types/userPoints';

/**
 * Общая коллекция «Моих точек» для ♥-тоггла карты и мастера travel: лёгкие
 * пины всех точек владельца одним запросом (`fields=pins`, #3161). Тот же
 * ключ и тот же запрос, что у экрана «Мои точки» (`usePointsDataModel`), —
 * сохранение в одном месте видно в другом. Координатный матчер
 * (`findSavedPointByCoord`) работает по `latitude`/`longitude` пина.
 *
 * До #3161 коллекция читалась полными карточками по 200 на страницу (#1706) и
 * могла лежать в кэше префиксом (#1709) — отсюда была отметка полноты. Пины
 * приходят целиком за один ответ, отметка больше не нужна.
 */
export function useSavedPointsCollection({ enabled }: { enabled: boolean }) {
  const owner = useQueryOwner();

  const query = useQuery<UserPointPin[]>({
    queryKey: queryKeys.userPointsAll(owner),
    queryFn: () => userPointsApi.getAllPins(),
    enabled,
    staleTime: USER_POINTS_COLLECTION_STALE_TIME_MS,
  });

  return {
    ...query,
    /** Кэшу можно верить: он либо не нужен (гость), либо уже загружен целиком. */
    isTrusted: !enabled || query.data !== undefined,
  };
}
