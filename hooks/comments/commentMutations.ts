import { useMutation, useQueryClient } from '@tanstack/react-query'

import { commentsApi } from '@/api/comments'
import type { TravelComment, TravelCommentCreate, TravelCommentUpdate } from '@/types/comments'
import {
  createOptimisticComment,
  optimisticAppendComment,
  optimisticToggleLike,
  reconcileLikeResponse,
  rollbackFromSnapshot,
} from '@/utils/commentCacheHelpers'

import { commentKeys } from './commentKeys'

type CachedQueryEntry = [readonly unknown[], unknown]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TravelCommentCreate) => commentsApi.createComment(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all })
      const previous = queryClient.getQueriesData({ queryKey: commentKeys.all })
      const optimistic = createOptimisticComment(data)
      optimisticAppendComment(queryClient, data, optimistic, previous as Array<[unknown, unknown]>)
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        ;(context.previous as CachedQueryEntry[]).forEach(([key, value]) => {
          queryClient.setQueryData(key, value)
        })
      }
    },
    onSuccess: (_newComment, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' })
      if (variables.travel_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.mainThread(variables.travel_id) })
      }
    },
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentUpdate }) =>
      commentsApi.updateComment(commentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.deleteComment(commentId),
    onSuccess: (_, deletedCommentId) => {
      queryClient.setQueriesData({ queryKey: commentKeys.all }, (old: unknown) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return (old as TravelComment[]).filter((comment) => comment?.id !== deletedCommentId)
        }
        if (isRecord(old) && old.id === deletedCommentId) {
          return undefined
        }
        return old
      })
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
        refetchType: 'active',
      })
    },
  })
}

export function useLikeComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.likeComment(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all })
      const previousData = optimisticToggleLike(queryClient, commentId, commentKeys.all, true)
      return { previousData }
    },
    onSuccess: (updatedComment, commentId) => {
      reconcileLikeResponse(queryClient, commentId, commentKeys.all, updatedComment as TravelComment, true)
    },
    onError: (_err, _commentId, context) => {
      rollbackFromSnapshot(queryClient, context?.previousData)
    },
  })
}

export function useUnlikeComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: number) => commentsApi.unlikeComment(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all })
      const previousData = optimisticToggleLike(queryClient, commentId, commentKeys.all, false)
      return { previousData }
    },
    onError: (_err, _commentId, context) => {
      rollbackFromSnapshot(queryClient, context?.previousData)
    },
  })
}

export function useReplyToComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: number; data: TravelCommentCreate }) =>
      commentsApi.replyToComment(commentId, data),
    onMutate: async ({ commentId, data }) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all })
      const previous = queryClient.getQueriesData({ queryKey: commentKeys.all })
      const optimistic = createOptimisticComment(data, commentId)
      optimisticAppendComment(queryClient, data, optimistic, previous as Array<[unknown, unknown]>)
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        ;(context.previous as CachedQueryEntry[]).forEach(([key, value]) => {
          queryClient.setQueryData(key, value)
        })
      }
    },
    onSuccess: (_newComment, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'active' })
      if (variables.data.travel_id) {
        queryClient.invalidateQueries({ queryKey: commentKeys.mainThread(variables.data.travel_id) })
      }
    },
  })
}
