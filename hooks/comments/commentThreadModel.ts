import type { TravelComment } from '@/types/comments'

export type CommentThreadModel = {
  topLevel: TravelComment[]
  replies: Record<number, TravelComment[]>
  allComments: Record<number, TravelComment>
  subThreadToParent: Record<number, number>
  warnedAllSubThread: boolean
}

export function buildCommentThreadModel(
  comments: TravelComment[],
  hasWarnedAllSubThread: boolean,
): CommentThreadModel {
  const topLevel: TravelComment[] = []
  const replies: Record<number, TravelComment[]> = {}
  const allComments: Record<number, TravelComment> = {}

  comments.forEach((comment) => {
    allComments[comment.id] = comment
  })

  const subThreadToParent: Record<number, number> = {}
  comments.forEach((comment) => {
    const subThread =
      typeof comment.sub_thread === 'string' ? Number(comment.sub_thread) : comment.sub_thread
    if (typeof subThread === 'number' && !Number.isNaN(subThread) && subThread > 0) {
      subThreadToParent[subThread] = comment.id
    }
  })

  comments.forEach((comment) => {
    const parentId = subThreadToParent[comment.thread]
    if (typeof parentId === 'number' && parentId !== comment.id && allComments[parentId]) {
      ;(replies[parentId] ??= []).push(comment)
      return
    }
    topLevel.push(comment)
  })

  if (topLevel.length === 0 && comments.length > 0) {
    return {
      topLevel: comments,
      replies: {},
      allComments,
      subThreadToParent,
      warnedAllSubThread: true,
    }
  }

  return {
    topLevel,
    replies,
    allComments,
    subThreadToParent,
    warnedAllSubThread: hasWarnedAllSubThread,
  }
}

export function findTopLevelAncestor(
  commentId: number,
  allComments: Record<number, TravelComment>,
  subThreadToParent: Record<number, number>,
): number | null {
  const visited = new Set<number>()
  let current = allComments[commentId]
  if (!current) return commentId

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    const parentId = subThreadToParent[current.thread]
    if (typeof parentId !== 'number' || parentId === current.id || !allComments[parentId]) {
      return current.id
    }
    current = allComments[parentId]
  }

  return commentId
}

export function getCommentParentChain(
  commentId: number,
  allComments: Record<number, TravelComment>,
  subThreadToParent: Record<number, number>,
): TravelComment[] {
  const chain: TravelComment[] = []
  const visited = new Set<number>()
  let currentComment = allComments[commentId]

  while (currentComment) {
    if (visited.has(currentComment.id)) break
    visited.add(currentComment.id)
    const parentId = subThreadToParent[currentComment.thread]
    if (typeof parentId !== 'number' || parentId === currentComment.id) break

    const parentComment = allComments[parentId]
    if (!parentComment) break

    chain.unshift(parentComment)
    currentComment = parentComment
  }

  return chain
}
