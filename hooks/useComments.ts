import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../src/api/comments';
import type {
  TravelComment,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '../types/comments';

export const commentKeys = {
  all: ['comments'] as const,
  threads: () => [...commentKeys.all, 'threads'] as const,
  thread: (threadId: number) => [...commentKeys.threads(), threadId] as const,
  mainThread: (travelId: number) => [...commentKeys.threads(), 'main', travelId] as const,
  comments: (threadId: number) => [...commentKeys.all, 'list', threadId] as const,
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
  return useQuery({
    queryKey: commentKeys.comments(threadId),
    queryFn: () => commentsApi.getComments(threadId),
    enabled: !!threadId && threadId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useComment(commentId: number) {
  return useQuery({
    queryKey: commentKeys.comment(commentId),
    queryFn: () => commentsApi.getComment(commentId),
    enabled: !!commentId && commentId > 0,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TravelCommentCreate) => commentsApi.createComment(data),
    onSuccess: (newComment) => {
      if (newComment.thread) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comments(newComment.thread),
        });
      }
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentUpdate }) =>
      commentsApi.updateComment(commentId, data),
    onSuccess: (updatedComment) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.comment(updatedComment.id),
      });
      if (updatedComment.thread) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comments(updatedComment.thread),
        });
      }
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.deleteComment(commentId),
    onSuccess: (_, commentId) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
  });
}

export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.likeComment(commentId),
    onMutate: async (commentId) => {
      const commentQueryKey = commentKeys.comment(commentId);
      await queryClient.cancelQueries({ queryKey: commentQueryKey });

      const previousComment = queryClient.getQueryData<TravelComment>(commentQueryKey);

      if (previousComment) {
        queryClient.setQueryData<TravelComment>(commentQueryKey, {
          ...previousComment,
          likes_count: previousComment.likes_count + 1,
          is_liked: true,
        });
      }

      return { previousComment };
    },
    onError: (err, commentId, context) => {
      if (context?.previousComment) {
        queryClient.setQueryData(
          commentKeys.comment(commentId),
          context.previousComment
        );
      }
    },
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comment(data.id),
        });
        if (data.thread) {
          queryClient.invalidateQueries({
            queryKey: commentKeys.comments(data.thread),
          });
        }
      }
    },
  });
}

export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.unlikeComment(commentId),
    onMutate: async (commentId) => {
      const commentQueryKey = commentKeys.comment(commentId);
      await queryClient.cancelQueries({ queryKey: commentQueryKey });

      const previousComment = queryClient.getQueryData<TravelComment>(commentQueryKey);

      if (previousComment) {
        queryClient.setQueryData<TravelComment>(commentQueryKey, {
          ...previousComment,
          likes_count: Math.max(0, previousComment.likes_count - 1),
          is_liked: false,
        });
      }

      return { previousComment };
    },
    onError: (err, commentId, context) => {
      if (context?.previousComment) {
        queryClient.setQueryData(
          commentKeys.comment(commentId),
          context.previousComment
        );
      }
    },
    onSettled: (_, __, commentId) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.comment(commentId),
      });
    },
  });
}

export function useReplyToComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentCreate }) =>
      commentsApi.replyToComment(commentId, data),
    onSuccess: (newComment) => {
      if (newComment.thread) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comments(newComment.thread),
        });
      }
      if (newComment.sub_thread) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comments(newComment.sub_thread),
        });
      }
    },
  });
}
