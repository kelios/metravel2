import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/queryKeys';
import { userPointsApi } from '@/api/userPoints';
import {
  USER_POINTS_COLLECTION_STALE_TIME_MS,
  isPointsCollectionPartial,
  markPointsCollectionComplete,
} from '@/api/userPointsCollectionCache';
import type { ImportedPoint } from '@/types/userPoints';

/**
 * Полная коллекция «Мои точки» для потребителей, которым нужен ответ «сохранена
 * ли эта точка»: map-попап (`useSavedPointToggle`) и карточка путешествия
 * (`usePointListSavedModel`). Один общий кэш-ключ с экраном «Мои точки», чтобы
 * сохранение/снятие в одном месте отражалось в другом.
 *
 * #1706: только `getAllPoints()` — одиночная страница отдаёт максимум 200 точек
 * (серверный потолок, #752), и всё сохранённое за их пределами показывалось как
 * несохранённое.
 *
 * #1709: тот же ключ пишет `usePointsDataModel` — первую страницу сразу, а
 * остальные докачивает фоном. Прерванная докачка (пользователь ушёл со страницы)
 * оставляла в кэше префикс, свежий ещё staleTime, и потребитель молча выдавал
 * его за полную коллекцию. Частичный кэш считаем протухшим — потребитель с
 * контрактом полноты идёт за своей полной коллекцией вместо чужого префикса.
 */
export function useSavedPointsCollection({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  // Read on every query-driven render: it controls both initial freshness and
  // whether the currently cached array is complete enough to trust.
  const partial = isPointsCollectionPartial(queryClient);

  const query = useQuery<ImportedPoint[]>({
    queryKey: queryKeys.userPointsAll(),
    queryFn: async () => {
      const points = await userPointsApi.getAllPoints();
      // Кэш заполнен целиком — снимаем признак частичности, иначе прерванный
      // стрим заставлял бы каждого следующего потребителя перечитывать всё.
      markPointsCollectionComplete(queryClient);
      return points;
    },
    enabled,
    staleTime: partial ? 0 : USER_POINTS_COLLECTION_STALE_TIME_MS,
  });

  return {
    ...query,
    // Existing partial data makes React Query report `isLoading=false` while
    // the completeness consumer is refetching the full collection. During that
    // window the prefix cannot answer whether an arbitrary coordinate is saved.
    // Disabled consumers do not need collection readiness (guest actions still
    // need to remain clickable so they can show the login hint). When enabled,
    // absence can be trusted only after some complete data exists; an initial
    // fetch error with `data === undefined` must stay fail-closed.
    isTrusted: !enabled || (query.data !== undefined && !partial),
  };
}
