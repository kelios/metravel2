import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/api/comments';
import type {
  TravelComment,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '../types/comments';

const mergeIsLikedFromCache = (
  next: TravelComment,
  prevById: Map<number, TravelComment>
): TravelComment => {
  if (typeof next.is_liked !== 'undefined') return next;
  const prev = prevById.get(next.id);
  if (!prev || typeof prev.is_liked === 'undefined') return next;
  return { ...next, is_liked: prev.is_liked };
};

const buildPrevById = (prev?: unknown): Map<number, TravelComment> => {
  const map = new Map<number, TravelComment>();
  if (!Array.isArray(prev)) return map;
  (prev as TravelComment[]).forEach((c) => map.set(c.id, c));
  return map;
};

export const commentKeys = {
  all: ['comments'] as const,
  threads: () => [...commentKeys.all, 'threads'] as const,
  thread: (threadId: number) => [...commentKeys.threads(), threadId] as const,
  mainThread: (travelId: number) => [...commentKeys.threads(), 'main', travelId] as const,
  comments: (threadId: number) => [...commentKeys.all, 'list', threadId] as const,
  travelComments: (travelId: number, threadId?: number | null) =>
    [...commentKeys.all, 'travel', travelId, threadId || 0] as const,
  comment: (commentId: number) => [...commentKeys.all, 'detail', commentId] as const,
};

export function useMainThread(travelId: number) {
  return useQuery({
    queryKey: commentKeys.mainThread(travelId),
    queryFn: () => commentsApi.getMainThread(travelId),
    enabled: !!travelId && travelId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useThread(threadId: number) {
  return useQuery({
    queryKey: commentKeys.thread(threadId),
    queryFn: () => commentsApi.getThread(threadId),
    enabled: !!threadId && threadId > 0,
  });
}

export function useComments(threadId: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: commentKeys.comments(threadId),
    queryFn: () => commentsApi.getComments(threadId),
    enabled: !!threadId && threadId > 0,
    select: (data) => {
      const prevById = buildPrevById(
        queryClient.getQueryData<TravelComment[]>(commentKeys.comments(threadId))
      );
      return data.map((c) => mergeIsLikedFromCache(c, prevById));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useTravelComments(travelId: number, threadId?: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: commentKeys.travelComments(travelId, threadId),
    queryFn: () => commentsApi.getTravelComments({ travelId, threadId }),
    enabled: !!travelId && travelId > 0,
    select: (data) => {
      const prevById = buildPrevById(
        queryClient.getQueryData<TravelComment[]>(
          commentKeys.travelComments(travelId, threadId)
        )
      );
      return data.map((c) => mergeIsLikedFromCache(c, prevById));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useComment(commentId: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: commentKeys.comment(commentId),
    queryFn: () => commentsApi.getComment(commentId),
    enabled: !!commentId && commentId > 0,
    select: (data) => {
      const prev = queryClient.getQueryData<TravelComment>(commentKeys.comment(commentId));
      if (typeof data.is_liked !== 'undefined') return data;
      if (!prev || typeof prev.is_liked === 'undefined') return data;
      return { ...data, is_liked: prev.is_liked };
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TravelCommentCreate) => commentsApi.createComment(data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches for comments-related queries
      await queryClient.cancelQueries({ queryKey: commentKeys.all });

      // Snapshot all existing comments caches (thread + travel variants)
      const previous = queryClient.getQueriesData({ queryKey: commentKeys.all });

      const optimisticComment: TravelComment = {
        id: Date.now(), // Temporary ID
        text: data.text,
        thread: data.thread_id ?? 0,
        sub_thread: null,
        user: 0, // Current user ID (will be replaced on refetch)
        user_name: 'Отправка...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        is_liked: false,
      };

      // Optimistically update relevant cached lists
      previous.forEach(([key, value]) => {
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

      return { previous };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, rollback all comments caches
      if (context?.previous) {
        (context.previous as Array<[unknown, unknown]>).forEach(([key, value]) => {
          queryClient.setQueryData(key as any, value);
        });
      }
    },
    onSuccess: (newComment, variables) => {
      // Refetch all comments-related queries (thread + travel variants) to reconcile optimistic state.
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' });

      // Main thread can appear after first comment is created.
      if (variables.travel_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.mainThread(variables.travel_id) });
      }
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentUpdate }) =>
      commentsApi.updateComment(commentId, data),
    onSuccess: () => {
      // Keep all list variants (thread + travel) in sync.
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.deleteComment(commentId),
    onSuccess: (_, _commentId) => {
      // Remove from any cached lists/details immediately so UI updates without waiting for refetch.
      queryClient.setQueriesData({ queryKey: commentKeys.all }, (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return (old as TravelComment[]).filter((c) => c?.id !== _commentId);
        }
        if (typeof old === 'object' && (old as any)?.id === _commentId) {
          return undefined;
        }
        return old;
      });
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
        refetchType: 'active',
      });
    },
  });
}

export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.likeComment(commentId),
    onMutate: async (commentId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: commentKeys.all });

      // Snapshot previous values
      const previousData: any = {};

      // Update all queries that contain this comment
      queryClient.getQueryCache().findAll({ queryKey: commentKeys.all }).forEach((query) => {
        const data = query.state.data;
        if (!data) return;

        // Handle single comment query
        if (Array.isArray(data)) {
          const comments = data as TravelComment[];
          const index = comments.findIndex((c) => c.id === commentId);
          if (index !== -1) {
            previousData[JSON.stringify(query.queryKey)] = data;
            const newComments = [...comments];
            newComments[index] = {
              ...newComments[index],
              likes_count: newComments[index].likes_count + 1,
              is_liked: true,
            };
            queryClient.setQueryData(query.queryKey, newComments);
          }
        } else if ((data as TravelComment).id === commentId) {
          previousData[JSON.stringify(query.queryKey)] = data;
          queryClient.setQueryData(query.queryKey, {
            ...(data as TravelComment),
            likes_count: (data as TravelComment).likes_count + 1,
            is_liked: true,
          });
        }
      });

      return { previousData };
    },
    onSuccess: (updatedComment, commentId) => {
      // Update cache with server response; preserve is_liked when backend omits it.
      queryClient.getQueryCache().findAll({ queryKey: commentKeys.all }).forEach((query) => {
        const data = query.state.data;
        if (!data) return;

        if (Array.isArray(data)) {
          const comments = data as TravelComment[];
          const index = comments.findIndex((c) => c.id === commentId);
          if (index !== -1) {
            const newComments = [...comments];
            newComments[index] = {
              ...newComments[index],
              ...(updatedComment as TravelComment),
              is_liked: true,
            };
            queryClient.setQueryData(query.queryKey, newComments);
          }
        } else if ((data as TravelComment).id === commentId) {
          const current = data as TravelComment;
          queryClient.setQueryData(query.queryKey, {
            ...current,
            ...(updatedComment as TravelComment),
            is_liked: true,
          });
        }
      });
    },
    onError: (err, commentId, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, value]) => {
          queryClient.setQueryData(JSON.parse(key), value);
        });
      }
    },
  });
}

export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.unlikeComment(commentId),
    onMutate: async (commentId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: commentKeys.all });

      // Snapshot previous values
      const previousData: any = {};

      // Update all queries that contain this comment
      queryClient.getQueryCache().findAll({ queryKey: commentKeys.all }).forEach((query) => {
        const data = query.state.data;
        if (!data) return;

        // Handle comments list
        if (Array.isArray(data)) {
          const comments = data as TravelComment[];
          const index = comments.findIndex((c) => c.id === commentId);
          if (index !== -1) {
            previousData[JSON.stringify(query.queryKey)] = data;
            const newComments = [...comments];
            newComments[index] = {
              ...newComments[index],
              likes_count: Math.max(0, newComments[index].likes_count - 1),
              is_liked: false,
            };
            queryClient.setQueryData(query.queryKey, newComments);
          }
        } else if ((data as TravelComment).id === commentId) {
          previousData[JSON.stringify(query.queryKey)] = data;
          queryClient.setQueryData(query.queryKey, {
            ...(data as TravelComment),
            likes_count: Math.max(0, (data as TravelComment).likes_count - 1),
            is_liked: false,
          });
        }
      });

      return { previousData };
    },
    onError: (err, commentId, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, value]) => {
          queryClient.setQueryData(JSON.parse(key), value);
        });
      }
    },
  });
}

export function useReplyToComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentCreate }) =>
      commentsApi.replyToComment(commentId, data),
    onMutate: async ({ commentId, data }) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: commentKeys.all });

      const optimisticComment: TravelComment = {
        id: Date.now(), // Temporary ID
        text: data.text,
        thread: data.thread_id ?? 0,
        sub_thread: commentId,
        user: 0,
        user_name: 'Отправка...',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        is_liked: false,
      };

      previous.forEach(([key, value]) => {
        if (!Array.isArray(value)) return;
        const queryKey = key as unknown as any[];
        const kind = queryKey?.[1];

        if (kind === 'list' && typeof data.thread_id === 'number' && queryKey?.[2] === data.thread_id) {
          queryClient.setQueryData<TravelComment[]>(queryKey as any, [...(value as TravelComment[]), optimisticComment]);
          return;
        }

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

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        (context.previous as Array<[unknown, unknown]>).forEach(([key, value]) => {
          queryClient.setQueryData(key as any, value);
        });
      }
    },
    onSuccess: (newComment, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' });
      if (variables.data.travel_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.mainThread(variables.data.travel_id) });
      }
    },
  });
}
