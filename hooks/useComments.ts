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
    onSuccess: (newComment, variables) => {
      // Invalidate the thread queries to fetch the newly created thread
      if (variables.travel_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.mainThread(variables.travel_id),
        });
      }
      
      // Invalidate the comments list for this thread
      if (newComment.thread) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.comments(newComment.thread),
        });
      }
      
      // Invalidate all comment queries to be safe
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
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
    onSuccess: (_, _commentId) => {
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
    onError: (err, commentId, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, value]) => {
          queryClient.setQueryData(JSON.parse(key), value);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
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
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}

export function useReplyToComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentCreate }) =>
      commentsApi.replyToComment(commentId, data),
    onSuccess: (_newComment) => {
      // Invalidate all comment queries to show new reply immediately
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });
    },
  });
}
