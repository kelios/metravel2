import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/api/comments';
import type {
  TravelComment,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '../types/comments';
import {
  mergeIsLikedFromCache,
  buildPrevById,
  optimisticToggleLike,
  reconcileLikeResponse,
  rollbackFromSnapshot,
  createOptimisticComment,
  optimisticAppendComment,
} from '@/utils/commentCacheHelpers';

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
      await queryClient.cancelQueries({ queryKey: commentKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: commentKeys.all });
      const optimistic = createOptimisticComment(data);
      optimisticAppendComment(queryClient, data, optimistic, previous as Array<[unknown, unknown]>);
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
      await queryClient.cancelQueries({ queryKey: commentKeys.all });
      const previousData = optimisticToggleLike(queryClient, commentId, commentKeys.all, true);
      return { previousData };
    },
    onSuccess: (updatedComment, commentId) => {
      reconcileLikeResponse(queryClient, commentId, commentKeys.all, updatedComment as TravelComment, true);
    },
    onError: (err, commentId, context) => {
      rollbackFromSnapshot(queryClient, context?.previousData);
    },
  });
}

export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.unlikeComment(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all });
      const previousData = optimisticToggleLike(queryClient, commentId, commentKeys.all, false);
      return { previousData };
    },
    onError: (err, commentId, context) => {
      rollbackFromSnapshot(queryClient, context?.previousData);
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
      const optimistic = createOptimisticComment(data, commentId);
      optimisticAppendComment(queryClient, data, optimistic, previous as Array<[unknown, unknown]>);
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
