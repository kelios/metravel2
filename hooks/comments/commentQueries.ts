import { useQuery, useQueryClient } from '@tanstack/react-query'

import { commentsApi } from '@/api/comments'
import type { TravelComment } from '@/types/comments'
import { buildPrevById, mergeIsLikedFromCache } from '@/utils/commentCacheHelpers'

import { commentKeys } from './commentKeys'

export function useMainThread(travelId: number, options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true
  return useQuery({
    queryKey: commentKeys.mainThread(travelId),
    queryFn: () => commentsApi.getMainThread(travelId),
    enabled: isEnabled && !!travelId && travelId > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useThread(threadId: number) {
  return useQuery({
    queryKey: commentKeys.thread(threadId),
    queryFn: () => commentsApi.getThread(threadId),
    enabled: !!threadId && threadId > 0,
  })
}

export function useComments(threadId: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: commentKeys.comments(threadId),
    queryFn: () => commentsApi.getComments(threadId),
    enabled: !!threadId && threadId > 0,
    select: (data) => {
      const prevById = buildPrevById(
        queryClient.getQueryData<TravelComment[]>(commentKeys.comments(threadId)),
      )
      return data.map((comment) => mergeIsLikedFromCache(comment, prevById))
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useTravelComments(
  travelId: number,
  threadId?: number | null,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient()
  const isEnabled = options?.enabled ?? true
  return useQuery({
    queryKey: commentKeys.travelComments(travelId, threadId),
    queryFn: () => commentsApi.getTravelComments({ travelId, threadId }),
    enabled: isEnabled && !!travelId && travelId > 0,
    select: (data) => {
      const prevById = buildPrevById(
        queryClient.getQueryData<TravelComment[]>(commentKeys.travelComments(travelId, threadId)),
      )
      return data.map((comment) => mergeIsLikedFromCache(comment, prevById))
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useComment(commentId: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: commentKeys.comment(commentId),
    queryFn: () => commentsApi.getComment(commentId),
    enabled: !!commentId && commentId > 0,
    select: (data) => {
      const prev = queryClient.getQueryData<TravelComment>(commentKeys.comment(commentId))
      if (typeof data.is_liked !== 'undefined') return data
      if (!prev || typeof prev.is_liked === 'undefined') return data
      return { ...data, is_liked: prev.is_liked }
    },
  })
}
