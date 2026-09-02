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

  // Читается на каждый рендер, но решает ровно в момент монтирования: именно там
  // React Query сверяет свежесть и решает, идти ли за данными.
  const partial = isPointsCollectionPartial(queryClient);

  return useQuery<ImportedPoint[]>({
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
}
