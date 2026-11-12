import { apiClient, ApiError } from './client';
import type {
  TravelComment,
  TravelCommentThread,
  TravelCommentTree,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '@/types/comments';

const getErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== 'object') return undefined;
  const rec = error as Record<string, unknown>;
  const status = typeof rec.status === 'number' ? rec.status : undefined;
  if (status !== undefined) return status;
  const resp = rec.response;
  if (resp && typeof resp === 'object' && typeof (resp as Record<string, unknown>).status === 'number') {
    return (resp as Record<string, unknown>).status as number;
  }
  return undefined;
};

type CommentPage = { results: TravelComment[]; next: string | null };

const isComment = (value: unknown): value is TravelComment => {
  if (!value || typeof value !== 'object') return false;
  const comment = value as Record<string, unknown>;
  return typeof comment.id === 'number' && typeof comment.thread === 'number'
    && (comment.sub_thread === null || typeof comment.sub_thread === 'number')
    && typeof comment.user === 'number' && typeof comment.text === 'string'
    && (comment.created_at === null || typeof comment.created_at === 'string')
    && (comment.updated_at === null || typeof comment.updated_at === 'string')
    && typeof comment.likes_count === 'number';
};

const readCommentPage = (data: unknown): CommentPage => {
  if (!data || typeof data !== 'object' || !('results' in data) || !('next' in data)
    || !Array.isArray(data.results) || !data.results.every(isComment)
    || (data.next !== null && (typeof data.next !== 'string' || !data.next.trim()))) {
    throw new Error('Invalid comments page');
  }
  return { results: data.results, next: data.next as string | null };
};

const readCommentList = async (lookup: string, expandSubThreads = false): Promise<TravelComment[]> => {
  const path = `/travel-comments/?${lookup}${expandSubThreads ? '&expand=sub_threads' : '&pagination=cursor'}`;
  let initial: unknown;
  try {
    initial = await apiClient.get<unknown>(path);
  } catch (error) {
    const status = getErrorStatus(error);
    // Only an initial missing/inaccessible discussion is an empty state.
    if (status === 400 || status === 404 || status === 401 || status === 403) return [];
    throw error;
  }
  if (Array.isArray(initial)) {
    if (!initial.every(isComment)) throw new Error('Invalid comments response');
    return initial;
  }
  if (expandSubThreads) throw new Error('Invalid expanded comments response');
  let page = readCommentPage(initial);
  const comments = [...page.results];
  const requestedCursors = new Set<string>();
  while (page.next !== null) {
    if (requestedCursors.has(page.next)) throw new Error('Repeated comments cursor');
    requestedCursors.add(page.next);
    page = readCommentPage(await apiClient.get<unknown>(`${path}&cursor=${encodeURIComponent(page.next)}`));
    comments.push(...page.results);
  }
  return comments;
};

export const commentsApi = {
  getMainThread: async (travelId: number): Promise<TravelCommentThread | null> => {
    try {
      return await apiClient.get<TravelCommentThread>(
        `/travel-comment-threads/main/?travel_id=${travelId}`
      );
    } catch (error) {
      // Some deployments return 404/400 when a main thread doesn't exist yet
      // (or when the backend rejects travel_id lookup before creating one).
      // Treat both as an empty state rather than a hard error.
      const status = getErrorStatus(error);
      if (status === 404 || status === 400) {
        return null;
      }
      // Some deployments protect thread metadata behind auth while still allowing
      // public comment reads. Treat "auth required" as "no thread info" so the UI
      // can fall back to other read strategies (e.g. fetching by travel_id).
      if (status === 401 || status === 403) {
        return null;
      }
      throw error;
    }
  },

  getThread: async (threadId: number): Promise<TravelCommentThread> => {
    return await apiClient.get<TravelCommentThread>(
      `/travel-comment-threads/${threadId}/`
    );
  },

  getComments: async (
    threadId: number,
    options?: { expandSubThreads?: boolean }
  ): Promise<TravelComment[]> => {
    return readCommentList(`thread_id=${threadId}`, options?.expandSubThreads);
  },

  getCommentsByTravel: async (
    travelId: number,
    options?: { expandSubThreads?: boolean }
  ): Promise<TravelComment[]> => {
    return readCommentList(`travel_id=${travelId}`, options?.expandSubThreads);
  },

  getTravelComments: async (params: {
    travelId: number;
    threadId?: number | null;
  }): Promise<TravelComment[]> => {
    const { travelId, threadId } = params;
    if (!(typeof travelId === 'number' && travelId > 0)) {
      return [];
    }

    // The backend uses a sub-thread model: a comment's `sub_thread` field
    // points to a *thread* ID that contains its replies, NOT a parent comment
    // ID.  Ask the backend to expand sub-threads server-side (BE-010), so the
    // whole conversation arrives in a single request as a flat list.
    let rootComments: TravelComment[];
    if (typeof threadId === 'number' && threadId > 0) {
      rootComments = await commentsApi.getComments(threadId, { expandSubThreads: true });
    } else {
      rootComments = await commentsApi.getCommentsByTravel(travelId, { expandSubThreads: true });
    }
    if (!Array.isArray(rootComments) || rootComments.length === 0) {
      return [];
    }

    const allComments = [...rootComments];

    // Threads already materialized in the response. When the backend honoured
    // `expand=sub_threads`, every reply (and thus its thread) is already here,
    // so the BFS below finds nothing left to fetch and issues zero requests.
    const fetched = new Set<number>(typeof threadId === 'number' ? [threadId] : []);
    for (const c of rootComments) {
      if (typeof c.thread === 'number' && c.thread > 0) {
        fetched.add(c.thread);
      }
    }

    // Fallback for older deployments that ignore `expand`: BFS the sub-threads
    // that were referenced but not delivered.
    const queue: number[] = [];
    const enqueueMissingSubThread = (c: TravelComment): void => {
      if (typeof c.sub_thread === 'number' && c.sub_thread > 0 && !fetched.has(c.sub_thread)) {
        queue.push(c.sub_thread);
        fetched.add(c.sub_thread);
      }
    };
    for (const c of rootComments) {
      enqueueMissingSubThread(c);
    }

    while (queue.length > 0) {
      const batch = queue.splice(0, 5); // fetch up to 5 sub-threads in parallel
      const results = await Promise.all(
        batch.map((stId) => commentsApi.getComments(stId))
      );
      for (const subComments of results) {
        for (const c of subComments) {
          allComments.push(c);
          enqueueMissingSubThread(c);
        }
      }
    }

    return allComments;
  },

  // Canonical comments tree (BE #711): the backend returns the whole
  // conversation already assembled (top_level with nested replies + a flat
  // list), so the client neither reconstructs threads from a flat list nor
  // issues BFS sub-thread requests. Returns `null` when the tree endpoint is
  // unavailable (older/stale deployments answering 404) so callers can fall
  // back to the flat `getTravelComments` path.
  getCommentTree: async (travelId: number): Promise<TravelCommentTree | null> => {
    if (!(typeof travelId === 'number' && travelId > 0)) {
      return null;
    }
    try {
      return await apiClient.get<TravelCommentTree>(
        `/travel-comments/tree/?travel_id=${travelId}`
      );
    } catch (error) {
      const status = getErrorStatus(error);
      // 404 => endpoint not deployed here; signal the flat fallback path.
      if (status === 404) {
        return null;
      }
      // 400 => backend rejected the travel_id lookup (e.g. after a DB reset);
      // treat as an empty, publicly readable discussion.
      if (status === 400) {
        return { travel_id: travelId, total_count: 0, top_level: [], flat: [] };
      }
      // Some deployments protect comment reads behind auth; degrade to empty.
      if (status === 401 || status === 403) {
        return { travel_id: travelId, total_count: 0, top_level: [], flat: [] };
      }
      throw error;
    }
  },

  getComment: async (commentId: number): Promise<TravelComment> => {
    return await apiClient.get<TravelComment>(
      `/travel-comments/${commentId}/`
    );
  },

  createComment: async (data: TravelCommentCreate): Promise<TravelComment> => {
    return await apiClient.post<TravelComment>('/travel-comments/', data);
  },

  updateComment: async (
    commentId: number,
    data: TravelCommentUpdate
  ): Promise<TravelComment> => {
    return await apiClient.put<TravelComment>(
      `/travel-comments/${commentId}/`,
      data
    );
  },

  patchComment: async (
    commentId: number,
    data: Partial<TravelCommentUpdate>
  ): Promise<TravelComment> => {
    return await apiClient.patch<TravelComment>(
      `/travel-comments/${commentId}/`,
      data
    );
  },

  deleteComment: async (commentId: number): Promise<void> => {
    await apiClient.delete(`/travel-comments/${commentId}/`);
  },

  likeComment: async (commentId: number): Promise<TravelComment> => {
    return await apiClient.post<TravelComment>(
      `/travel-comments/${commentId}/like/`,
      {}
    );
  },

  unlikeComment: async (commentId: number): Promise<void> => {
    await apiClient.delete(`/travel-comments/${commentId}/like/`);
  },

  replyToComment: async (
    commentId: number,
    data: TravelCommentCreate
  ): Promise<TravelComment> => {
    return await apiClient.post<TravelComment>(
      `/travel-comments/${commentId}/reply/`,
      data
    );
  },
};
