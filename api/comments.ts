import { apiClient, ApiError } from './client';
import type {
  TravelComment,
  TravelCommentThread,
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
    try {
      const expand = options?.expandSubThreads ? '&expand=sub_threads' : '';
      return await apiClient.get<TravelComment[]>(
        `/travel-comments/?thread_id=${threadId}${expand}`
      );
    } catch (error) {
      const status = getErrorStatus(error);
      // Some backends return 400/404 for an empty or missing thread instead of [].
      if (status === 400 || status === 404) {
        return [];
      }
      // Some deployments protect comments behind auth; the read UI should degrade
      // to an empty discussion instead of showing a hard unavailable state.
      if (status === 401 || status === 403) {
        return [];
      }
      throw error;
    }
  },

  getCommentsByTravel: async (
    travelId: number,
    options?: { expandSubThreads?: boolean }
  ): Promise<TravelComment[]> => {
    try {
      const expand = options?.expandSubThreads ? '&expand=sub_threads' : '';
      return await apiClient.get<TravelComment[]>(
        `/travel-comments/?travel_id=${travelId}${expand}`
      );
    } catch (error) {
      const status = getErrorStatus(error);
      // Some backends return 404 for an empty travel thread instead of [].
      if (status === 404) {
        return [];
      }
      // After E2E runs / DB resets the "main thread" can be missing, and some backends
      // respond with 400 for travel_id lookups instead of returning an empty list.
      // Treat this as an empty state so comments remain publicly readable.
      if (status === 400) {
        return [];
      }
      // Some deployments protect comments behind auth; treat as empty.
      if (status === 401 || status === 403) {
        return [];
      }
      throw error;
    }
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
        batch.map((stId) => commentsApi.getComments(stId).catch(() => [] as TravelComment[]))
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
