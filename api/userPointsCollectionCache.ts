import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from './queryKeys';

/**
 * #1831: ключ коллекции несёт владельца, поэтому и отметка полноты обязана его
 * нести — иначе признак «докачано целиком» от предыдущего пользователя выдал бы
 * пустую коллекцию следующего за полную.
 *
 * Кэш-ключ `userPointsAll` делят между собой producer с ЧАСТИЧНЫМ контрактом
 * (`usePointsDataModel` — первая страница сразу, остальные докачиваются в фоне)
 * и потребители с контрактом ПОЛНОТЫ (`useSavedPointToggle`,
 * `usePointListSavedModel` — вся коллекция одним `getAllPoints()`).
 *
 * React Query смотрит только на ключ и на свежесть данных, а не на то, чей
 * `queryFn` их положил. Поэтому #1709: пользователь уходил со страницы «Мои
 * точки» до конца фоновой докачки, недокачанный префикс оставался в кэше свежим
 * ещё staleTime, и сохранённая точка за его пределами показывалась
 * несохранённой на карте и в карточке путешествия.
 *
 * Признак полноты живёт рядом с данными: producer отмечает докачку завершённой,
 * а потребители обязаны прочитать признак ПРЕЖДЕ, чем довериться кэшу.
 */
export type PointsPaginationState = {
  /** Страница, с которой продолжится фоновая докачка. */
  nextPage: number;
  /** Коллекция в кэше полная — доверять ей можно. */
  complete: boolean;
};

/** Общий staleTime коллекции: одинаковый у producer'а и у потребителей. */
export const USER_POINTS_COLLECTION_STALE_TIME_MS = 10 * 60 * 1000;

export const readPointsPaginationState = (
  queryClient: QueryClient,
  userId: string | null,
): PointsPaginationState | undefined =>
  queryClient.getQueryData<PointsPaginationState>(queryKeys.userPointsPagination(userId));

export const writePointsPaginationState = (
  queryClient: QueryClient,
  userId: string | null,
  state: PointsPaginationState,
): void => {
  // Отметка обязана пережить сами данные. Её запись — это `setQueryData` без
  // наблюдателей и без фетчей, а `gcTime` React Query продлевает только на
  // подписке и на фетче: с общим 10-минутным `gcTime` метаданные исчезли бы
  // раньше частичного префикса, и он снова сошёл бы за полную коллекцию.
  // Дефолты применяются при СОЗДАНИИ записи, поэтому ставим их до первой записи.
  queryClient.setQueryDefaults(queryKeys.userPointsPagination(userId), { gcTime: Infinity });
  queryClient.setQueryData<PointsPaginationState>(
    queryKeys.userPointsPagination(userId),
    state,
  );
};

/**
 * В кэше лежит незавершённый префикс коллекции — доверять ему нельзя.
 *
 * Отсутствие метаданных частичностью НЕ считается: так выглядит либо ещё пустой
 * кэш, либо кэш, заполненный полным чтением `getAllPoints()`.
 */
export const isPointsCollectionPartial = (
  queryClient: QueryClient,
  userId: string | null,
): boolean => {
  const state = readPointsPaginationState(queryClient, userId);
  return state !== undefined && !state.complete;
};

/**
 * Коллекция прочитана целиком (`getAllPoints()`). Отметка обязательна: без неё
 * прерванный ранее стрим оставил бы `complete: false` навсегда, и каждый
 * следующий потребитель перечитывал бы всю коллекцию заново.
 */
export const markPointsCollectionComplete = (
  queryClient: QueryClient,
  userId: string | null,
): void => {
  const state = readPointsPaginationState(queryClient, userId);
  writePointsPaginationState(queryClient, userId, {
    nextPage: state?.nextPage ?? 1,
    complete: true,
  });
};
