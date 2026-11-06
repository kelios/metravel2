import { useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'

import { deletePlaceComment, getPlaceComments, postPlaceComment, type PlaceComment, type PlaceCommentsPage } from '@/api/placeComments'
import { queryKeys } from '@/api/queryKeys'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { useAuthStore } from '@/stores/authStore'
import { readRetryOnce } from '@/utils/queryRetryPolicy'

type WriteTarget = { pointId: number; owner: string | null }

const isCurrentOwner = (owner: string | null) => {
  const state = useAuthStore.getState()
  return owner !== null && state.isAuthenticated && state.userId === owner
}

const guardOwner = (owner: string | null) => {
  const ensureCurrentOwner = () => {
    if (isCurrentOwner(owner)) return
    const error = new Error('Place comment viewer changed')
    error.name = 'AbortError'
    throw error
  }
  ensureCurrentOwner()
  return ensureCurrentOwner
}

/** Mounted by the open discussion only. The article pager never owns its identity. */
export function usePlaceComments(pointId: number) {
  const queryClient = useQueryClient()
  const owner = useQueryOwner()
  const authReady = useAuthStore((state) => state.authReady)
  const query = useInfiniteQuery({
    queryKey: queryKeys.placeComments(owner, pointId),
    queryFn: ({ pageParam, signal }) => getPlaceComments(pointId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage, _pages, _cursor, previousCursors) =>
      lastPage.next && !previousCursors.includes(lastPage.next) ? lastPage.next : undefined,
    enabled: authReady,
    retry: readRetryOnce,
  })

  const comments = useMemo(() => {
    const byId = new Map<number, PlaceComment>()
    query.data?.pages.forEach((page) => page.results.forEach((comment) => {
      if (!byId.has(comment.id)) byId.set(comment.id, comment)
    }))
    return [...byId.values()]
  }, [query.data])

  const refreshAfterWrite = async (target: WriteTarget, deletedId?: number) => {
    if (!isCurrentOwner(target.owner)) return
    const filter = { queryKey: queryKeys.placeComments(target.owner, target.pointId), exact: true }
    await queryClient.cancelQueries(filter)
    if (!isCurrentOwner(target.owner)) return
    if (deletedId !== undefined) {
      queryClient.setQueryData<InfiniteData<PlaceCommentsPage>>(filter.queryKey, (old) => old && ({
        ...old,
        pages: old.pages.map((page) => ({ ...page, results: page.results.filter((comment) => comment.id !== deletedId) })),
      }))
    }
    // The server can accept a submission into moderation without publishing it.
    // Only the list endpoint decides which posts may be shown in the discussion.
    void queryClient.invalidateQueries(filter)
  }

  const post = useMutation({
    mutationFn: (input: WriteTarget & { text: string }) =>
      postPlaceComment(input.pointId, input.text, guardOwner(input.owner)),
    onSuccess: (_created, input) => refreshAfterWrite(input),
  })
  const remove = useMutation({
    mutationFn: (input: WriteTarget & { commentId: number }) =>
      deletePlaceComment(input.pointId, input.commentId, guardOwner(input.owner)),
    onSuccess: (_result, input) => refreshAfterWrite(input, input.commentId),
  })

  return { owner, authReady, comments, query, post, remove }
}
