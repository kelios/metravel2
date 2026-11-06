import { apiClient } from '@/api/client'

export const PLACE_COMMENT_MAX_LENGTH = 10_000

export type PlaceComment = {
  id: number
  text: string
  created_at: string
  user: number
  user_name: string
  user_avatar: string | null
}

export type PlaceCommentsPage = { results: PlaceComment[]; next: string | null }
export type PlaceCommentSubmission = { heldForModeration: boolean }

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const isPlaceComment = (value: unknown): value is PlaceComment => {
  if (!value || typeof value !== 'object') return false
  const comment = value as Record<string, unknown>
  return isId(comment.id) && isId(comment.user)
    && typeof comment.text === 'string' && typeof comment.created_at === 'string'
    && typeof comment.user_name === 'string'
    && (comment.user_avatar === null || typeof comment.user_avatar === 'string')
}

const commentsPath = (pointId: number) => {
  if (!isId(pointId)) throw new Error('Invalid place point id')
  return `/places/${pointId}/comments/`
}

const readNextCursor = (next: string | null): string | null => {
  const value = next?.trim()
  if (!value) return null
  // DRF may return an absolute next-page link. Only reuse its cursor and keep
  // credentials and requests on the original place endpoint.
  if (value.includes('?') || value.startsWith('/') || /^https?:\/\//i.test(value)) {
    return new URL(value, 'https://metravel.by').searchParams.get('cursor')
  }
  return value
}

export async function getPlaceComments(
  pointId: number,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<PlaceCommentsPage> {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
  const data = await apiClient.get<Partial<PlaceCommentsPage> | null>(
    `${commentsPath(pointId)}${query}`, undefined, { signal },
  )
  if (!data || !Array.isArray(data.results) || !data.results.every(isPlaceComment)
    || (data.next !== null && typeof data.next !== 'string')) {
    throw new Error('Invalid place comments response')
  }
  return { results: data.results, next: readNextCursor(data.next) }
}

export async function postPlaceComment(pointId: number, text: string, beforeFetch: () => void): Promise<PlaceCommentSubmission> {
  const trimmed = text.trim()
  if (!trimmed || Array.from(trimmed).length > PLACE_COMMENT_MAX_LENGTH) {
    throw new Error('Invalid place comment length')
  }
  const accepted = await apiClient.post<unknown>(
    commentsPath(pointId), { text: trimmed }, undefined, { expectedStatus: 201, beforeFetch },
  )
  if (!isPlaceComment(accepted) || !('is_hidden' in accepted) || typeof accepted.is_hidden !== 'boolean') {
    throw new Error('Invalid place comment submission response')
  }
  return { heldForModeration: accepted.is_hidden }
}

export async function deletePlaceComment(pointId: number, commentId: number, beforeFetch: () => void): Promise<void> {
  if (!isId(commentId)) throw new Error('Invalid place comment id')
  await apiClient.request<null>(`${commentsPath(pointId)}${commentId}/`, {
    method: 'DELETE', expectedStatus: 204, beforeFetch,
  })
}
