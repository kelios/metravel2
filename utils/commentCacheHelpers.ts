// utils/commentCacheHelpers.ts
// Чистые хелперы для оптимистичного обновления кэша комментариев.
// Извлечены из hooks/useComments.ts для устранения дублирования и независимого тестирования.

import type { TravelComment, TravelCommentCreate } from '@/types/comments';
import type { QueryClient } from '@tanstack/react-query';

// ===================== Merge helpers =====================

export const mergeIsLikedFromCache = (
  next: TravelComment,
  prevById: Map<number, TravelComment>
): TravelComment => {
  if (typeof next.is_liked !== 'undefined') return next;
  const prev = prevById.get(next.id);
  if (!prev || typeof prev.is_liked === 'undefined') return next;
  return { ...next, is_liked: prev.is_liked };
};

export const buildPrevById = (prev?: unknown): Map<number, TravelComment> => {
  const map = new Map<number, TravelComment>();
  if (!Array.isArray(prev)) return map;
  (prev as TravelComment[]).forEach((c) => map.set(c.id, c));
  return map;
};

// ===================== Optimistic like/unlike =====================

/**
 * Оптимистично обновляет likes_count и is_liked для комментария во всех кэшах.
 * Возвращает snapshot предыдущих данных для отката.
 */
export function optimisticToggleLike(
  queryClient: QueryClient,
  commentId: number,
  queryKey: readonly unknown[],
  liked: boolean,
): Record<string, unknown> {
  const previousData: Record<string, unknown> = {};
  const delta = liked ? 1 : -1;

  queryClient.getQueryCache().findAll({ queryKey }).forEach((query) => {
    const data = query.state.data;
    if (!data) return;

    if (Array.isArray(data)) {
      const comments = data as TravelComment[];
      const index = comments.findIndex((c) => c.id === commentId);
      if (index !== -1) {
        previousData[JSON.stringify(query.queryKey)] = data;
        const newComments = [...comments];
        newComments[index] = {
          ...newComments[index],
          likes_count: Math.max(0, newComments[index].likes_count + delta),
          is_liked: liked,
        };
        queryClient.setQueryData(query.queryKey, newComments);
      }
    } else if ((data as TravelComment).id === commentId) {
      previousData[JSON.stringify(query.queryKey)] = data;
      queryClient.setQueryData(query.queryKey, {
        ...(data as TravelComment),
        likes_count: Math.max(0, (data as TravelComment).likes_count + delta),
        is_liked: liked,
      });
    }
  });

  return previousData;
}

/**
 * Применяет серверный ответ после like/unlike ко всем кэшам, сохраняя is_liked.
 */
export function reconcileLikeResponse(
  queryClient: QueryClient,
  commentId: number,
  queryKey: readonly unknown[],
  updatedComment: TravelComment,
  liked: boolean,
): void {
  queryClient.getQueryCache().findAll({ queryKey }).forEach((query) => {
    const data = query.state.data;
    if (!data) return;

    if (Array.isArray(data)) {
      const comments = data as TravelComment[];
      const index = comments.findIndex((c) => c.id === commentId);
      if (index !== -1) {
        const newComments = [...comments];
        newComments[index] = {
          ...newComments[index],
          ...updatedComment,
          is_liked: liked,
        };
        queryClient.setQueryData(query.queryKey, newComments);
      }
    } else if ((data as TravelComment).id === commentId) {
      const current = data as TravelComment;
      queryClient.setQueryData(query.queryKey, {
        ...current,
        ...updatedComment,
        is_liked: liked,
      });
    }
  });
}

/**
 * Откатывает оптимистичное обновление по snapshot.
 */
export function rollbackFromSnapshot(
  queryClient: QueryClient,
  previousData: Record<string, unknown> | undefined,
): void {
  if (!previousData) return;
  Object.entries(previousData).forEach(([key, value]) => {
    queryClient.setQueryData(JSON.parse(key), value);
  });
}

// ===================== Optimistic comment append =====================

/**
 * Создаёт оптимистичный комментарий для немедленного отображения в UI.
 */
export function createOptimisticComment(
  data: TravelCommentCreate,
  parentCommentId?: number,
): TravelComment {
  return {
    id: Date.now(), // Temporary ID
    text: data.text,
    thread: data.thread_id ?? 0,
    sub_thread: parentCommentId ?? null,
    user: 0, // Current user ID (will be replaced on refetch)
    user_name: 'Отправка...',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 0,
    is_liked: false,
  };
}

/**
 * Оптимистично добавляет комментарий в релевантные кэши (thread-based и travel-based).
 */
export function optimisticAppendComment(
  queryClient: QueryClient,
  data: TravelCommentCreate,
  optimisticComment: TravelComment,
  allQueriesData: Array<[unknown, unknown]>,
): void {
  allQueriesData.forEach(([key, value]) => {
    if (!Array.isArray(value)) return;

    const queryKey = key as unknown as any[];
    const kind = queryKey?.[1];

    // Thread-based cache: ['comments', 'list', threadId]
    if (kind === 'list' && typeof data.thread_id === 'number' && queryKey?.[2] === data.thread_id) {
      queryClient.setQueryData<TravelComment[]>(queryKey as any, [...(value as TravelComment[]), optimisticComment]);
      return;
    }

    // Travel-based cache: ['comments', 'travel', travelId, threadId]
    if (kind === 'travel') {
      const travelIdInKey = queryKey?.[2];
      const threadIdInKey = queryKey?.[3];

      if (typeof data.travel_id === 'number' && travelIdInKey === data.travel_id) {
        queryClient.setQueryData<TravelComment[]>(queryKey as any, [...(value as TravelComment[]), optimisticComment]);
        return;
      }

      if (typeof data.thread_id === 'number' && threadIdInKey === data.thread_id) {
        queryClient.setQueryData<TravelComment[]>(queryKey as any, [...(value as TravelComment[]), optimisticComment]);
        return;
      }
    }
  });
}
