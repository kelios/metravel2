import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteTravel, fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import type { Travel } from '@/types/types';
import { normalizeToTravel } from '@/components/profile/travelNormalize';
import { confirmAction } from '@/utils/confirmAction';
import type { TravelEngagementStats } from '@/utils/travelEngagementStats'
import { showToastMessage } from '@/utils/toast'

interface UseMyTravelsArgs {
  userId?: string | null;
  perPage: number;
  includeDrafts?: boolean;
  onTotalChange?: (total: number) => void;
}

export interface UseMyTravelsResult {
  myTravels: Travel[];
  engagementSummary: TravelEngagementStats | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  removingTravelId: number | null;
  hasMore: boolean;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  remove: (travelId: number) => Promise<void>;
}

const toDecrementedMetric = (current: number | null | undefined, delta: number | null | undefined) => {
  if (current == null) return current ?? null
  return Math.max(0, current - (delta ?? 0))
}

const decrementSummaryByTravel = (
  current: TravelEngagementStats | null,
  travel: Travel | undefined
): TravelEngagementStats | null => {
  if (!current || !travel?.engagementStats) return current

  return {
    favoritesCount: toDecrementedMetric(current.favoritesCount, travel.engagementStats.favoritesCount),
    wishlistCount: toDecrementedMetric(current.wishlistCount, travel.engagementStats.wishlistCount),
    visitedCount: toDecrementedMetric(current.visitedCount, travel.engagementStats.visitedCount),
    plannedCount: toDecrementedMetric(current.plannedCount, travel.engagementStats.plannedCount),
  }
}

const getDeleteErrorCopy = (error: unknown) => {
  const errorStatus =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()

  if (
    errorStatus === 404 ||
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('не найден')
  ) {
    return {
      isAlreadyDeleted: true,
      title: 'Маршрут уже удалён',
      description: 'Обновили список, чтобы синхронизировать профиль.',
    }
  }

  if (errorStatus === 403 || message.includes('403') || message.includes('доступ')) {
    return {
      isAlreadyDeleted: false,
      title: 'Нет доступа',
      description: 'У вас нет прав для удаления этого маршрута.',
    }
  }

  if (message.includes('timeout') || message.includes('время ожидания')) {
    return {
      isAlreadyDeleted: false,
      title: 'Превышено время ожидания',
      description: 'Проверьте интернет и попробуйте снова.',
    }
  }

  if (message.includes('network') || message.includes('сеть')) {
    return {
      isAlreadyDeleted: false,
      title: 'Проблема с подключением',
      description: 'Проверьте интернет и попробуйте снова.',
    }
  }

  return {
    isAlreadyDeleted: false,
    title: 'Не удалось удалить маршрут',
    description: error instanceof Error && error.message ? error.message : 'Попробуйте позже.',
  }
}

export function useMyTravels({ userId, perPage, includeDrafts = false, onTotalChange }: UseMyTravelsArgs): UseMyTravelsResult {
  const [myTravels, setMyTravels] = useState<Travel[]>([]);
  const [engagementSummary, setEngagementSummary] = useState<TravelEngagementStats | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [removingTravelId, setRemovingTravelId] = useState<number | null>(null)
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false);
  const deleteInFlightRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  // Монотонный счётчик: и load, и loadMore инкрементят его. После await коммитит
  // только последний запрос — поздний loadMore не затирает свежий результат load
  // (например onRefresh во время подгрузки следующей страницы).
  const requestSeqRef = useRef(0)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRemovingTravelId(null)
      setPage(1);
      setTotalCount(0)
      setHasMore(false);
      setMyTravels([]);
      setEngagementSummary(null)
      return;
    }
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    try {
      const payload = await fetchMyTravels({ user_id: uid, page: 1, perPage, includeDrafts });
      // Запрос вытеснен более новым load/loadMore или хук размонтирован — не коммитим.
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);
      const effectiveTotal = total || normalized.length;

      setMyTravels(normalized);
      setEngagementSummary(nextEngagementSummary)
      setPage(1);
      setTotalCount(effectiveTotal)
      setHasMore(normalized.length < effectiveTotal && items.length > 0);
      onTotalChange?.(effectiveTotal);
    } catch {
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      setMyTravels([]);
      setEngagementSummary(null)
      setPage(1);
      setTotalCount(0)
      setHasMore(false);
      onTotalChange?.(0);
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setIsLoading(false);
    }
  }, [userId, perPage, includeDrafts, onTotalChange]);

  const loadMore = useCallback(async () => {
    const uid = userId;
    if (!uid) return;
    if (isLoading || isLoadingMore || !hasMore) return;
    if (myTravels.length === 0) return;

    const nextPage = page + 1;
    const seq = ++requestSeqRef.current;
    setIsLoadingMore(true);
    try {
      const payload = await fetchMyTravels({ user_id: uid, page: nextPage, perPage, includeDrafts });
      // Вытеснен более новым load (onRefresh) / loadMore или unmount — не коммитим,
      // иначе устаревший merged затрёт свежую страницу 1.
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);

      const existingIds = new Set(myTravels.map((travel) => String(travel.id)));
      const uniqueNext = normalized.filter((travel) => !existingIds.has(String(travel.id)));
      const merged = uniqueNext.length > 0 ? [...myTravels, ...uniqueNext] : myTravels;
      const effectiveTotal = total || merged.length;

      setMyTravels(merged);
      setEngagementSummary((current) => current ?? nextEngagementSummary)
      setPage(nextPage);
      setTotalCount(effectiveTotal)
      setHasMore(merged.length < effectiveTotal && items.length > 0);
      onTotalChange?.(effectiveTotal);
    } catch {
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      setHasMore(false);
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setIsLoadingMore(false);
    }
  }, [userId, perPage, includeDrafts, page, isLoading, isLoadingMore, hasMore, myTravels, onTotalChange]);

  const remove = useCallback(
    async (travelId: number) => {
      try {
        const ok = await confirmAction({
          title: 'Удалить путешествие',
          message: 'Удалить этот маршрут? Действие нельзя отменить.',
          confirmText: 'Удалить',
          cancelText: 'Отмена',
        });
        if (!ok) return;

        if (deleteInFlightRef.current === travelId) return

        const previousTravels = myTravels
        const deletedTravel = previousTravels.find((travel) => travel.id === travelId)
        const previousTotal = totalCount
        const nextTravels = previousTravels.filter((travel) => travel.id !== travelId)
        const nextTotal = Math.max(0, previousTotal - 1)

        deleteInFlightRef.current = travelId
        setRemovingTravelId(travelId)
        setMyTravels(nextTravels)
        setEngagementSummary((current) => decrementSummaryByTravel(current, deletedTravel))
        setTotalCount(nextTotal)
        onTotalChange?.(nextTotal)

        await deleteTravel(travelId);
        void showToastMessage({
          type: 'success',
          text1: 'Маршрут удалён',
          text2: 'Профиль обновлён.',
        })
        await load();
      } catch (error) {
        const deleteCopy = getDeleteErrorCopy(error)

        if (deleteCopy.isAlreadyDeleted) {
          void showToastMessage({
            type: 'info',
            text1: deleteCopy.title,
            text2: deleteCopy.description,
          })
          await load()
        } else {
          if (mountedRef.current) {
            setMyTravels(myTravels)
            setEngagementSummary(engagementSummary)
            setTotalCount(totalCount)
            onTotalChange?.(totalCount)
          }
          void showToastMessage({
            type: 'error',
            text1: deleteCopy.title,
            text2: deleteCopy.description,
            visibilityTime: 4000,
          })
          console.error('Error deleting travel:', error);
        }
      } finally {
        deleteInFlightRef.current = null
        if (mountedRef.current) setRemovingTravelId(null)
      }
    },
    [engagementSummary, load, myTravels, onTotalChange, totalCount],
  );

  return { myTravels, engagementSummary, isLoading, isLoadingMore, removingTravelId, hasMore, load, loadMore, remove };
}
