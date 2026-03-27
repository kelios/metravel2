export const commentKeys = {
  all: ['comments'] as const,
  threads: () => [...commentKeys.all, 'threads'] as const,
  thread: (threadId: number) => [...commentKeys.threads(), threadId] as const,
  mainThread: (travelId: number) => [...commentKeys.threads(), 'main', travelId] as const,
  comments: (threadId: number) => [...commentKeys.all, 'list', threadId] as const,
  travelComments: (travelId: number, threadId?: number | null) =>
    [...commentKeys.all, 'travel', travelId, threadId || 0] as const,
  comment: (commentId: number) => [...commentKeys.all, 'detail', commentId] as const,
}
