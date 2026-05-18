import { useCallback, useRef, useState } from 'react';
import { deleteTravel, fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import type { Travel } from '@/types/types';
import { normalizeToTravel } from '@/components/profile/travelNormalize';
import { confirmAction } from '@/utils/confirmAction';
import type { TravelEngagementStats } from '@/utils/travelEngagementStats'

interface UseMyTravelsArgs {
  userId?: string | null;
  perPage: number;
  onTotalChange?: (total: number) => void;
}

export interface UseMyTravelsResult {
  myTravels: Travel[];
  engagementSummary: TravelEngagementStats | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  remove: (travelId: number) => Promise<void>;
}

export function useMyTravels({ userId, perPage, onTotalChange }: UseMyTravelsArgs): UseMyTravelsResult {
  const [myTravels, setMyTravels] = useState<Travel[]>([]);
  const [engagementSummary, setEngagementSummary] = useState<TravelEngagementStats | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const lastRequestRef = useRef(0);

  const load = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      setIsLoading(false);
      setIsLoadingMore(false);
      setPage(1);
      setHasMore(false);
      setMyTravels([]);
      setEngagementSummary(null)
      return;
    }
    setIsLoading(true);
    setIsLoadingMore(false);
    lastRequestRef.current = 0;
    try {
      const payload = await fetchMyTravels({ user_id: uid, page: 1, perPage });
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);
      const effectiveTotal = total || normalized.length;

      setMyTravels(normalized);
      setEngagementSummary(nextEngagementSummary)
      setPage(1);
      setHasMore(normalized.length < effectiveTotal && items.length > 0);
      onTotalChange?.(effectiveTotal);
    } catch {
      setMyTravels([]);
      setEngagementSummary(null)
      setPage(1);
      setHasMore(false);
      onTotalChange?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId, perPage, onTotalChange]);

  const loadMore = useCallback(async () => {
    const uid = userId;
    if (!uid) return;
    if (isLoading || isLoadingMore || !hasMore) return;
    if (myTravels.length === 0) return;

    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const payload = await fetchMyTravels({ user_id: uid, page: nextPage, perPage });
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);

      const existingIds = new Set(myTravels.map((travel) => String(travel.id)));
      const uniqueNext = normalized.filter((travel) => !existingIds.has(String(travel.id)));
      const merged = uniqueNext.length > 0 ? [...myTravels, ...uniqueNext] : myTravels;
      const effectiveTotal = total || merged.length;

      setMyTravels(merged);
      setEngagementSummary((current) => current ?? nextEngagementSummary)
      setPage(nextPage);
      setHasMore(merged.length < effectiveTotal && items.length > 0);
      onTotalChange?.(effectiveTotal);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, perPage, page, isLoading, isLoadingMore, hasMore, myTravels, onTotalChange]);

  const remove = useCallback(
    async (travelId: number) => {
      try {
        const ok = await confirmAction({
          title: 'Удалить путешествие',
          message: 'Удалить это путешествие?',
          confirmText: 'Удалить',
          cancelText: 'Отмена',
        });
        if (!ok) return;
        await deleteTravel(travelId);
        await load();
      } catch (error) {
        console.error('Error deleting travel:', error);
      }
    },
    [load],
  );

  return { myTravels, engagementSummary, isLoading, isLoadingMore, hasMore, load, loadMore, remove };
}
