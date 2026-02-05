import { apiClient, ApiError } from './client';
import type {
  TravelComment,
  TravelCommentThread,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '../../types/comments';

const getErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== 'object') return undefined;
  const anyErr = error as any;
  const status =
    typeof anyErr.status === 'number'
      ? anyErr.status
      : (typeof anyErr?.response?.status === 'number' ? anyErr.response.status : undefined);
  return status;
};

export const commentsApi = {
  getMainThread: async (travelId: number): Promise<TravelCommentThread | null> => {
    try {
      return await apiClient.get<TravelCommentThread>(
        `/travel-comment-threads/main/?travel_id=${travelId}`
      );
    } catch (error) {
      // Backend can return 404 when a main thread doesn't exist yet (no comments).
      // Treat this as an empty state rather than a hard error.
      const status = getErrorStatus(error);
      if (status === 404) {
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

  getComments: async (threadId: number): Promise<TravelComment[]> => {
    try {
      return await apiClient.get<TravelComment[]>(
        `/travel-comments/?thread_id=${threadId}`
      );
    } catch (error) {
      // Some backends return 404 for an empty thread instead of [].
      if (getErrorStatus(error) === 404) {
        return [];
      }
      throw error;
    }
  },

  getCommentsByTravel: async (travelId: number): Promise<TravelComment[]> => {
    try {
      return await apiClient.get<TravelComment[]>(
        `/travel-comments/?travel_id=${travelId}`
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
      throw error;
    }
  },

  getTravelComments: async (params: {
    travelId: number;
    threadId?: number | null;
  }): Promise<TravelComment[]> => {
    const { travelId, threadId } = params;
    if (typeof threadId === 'number' && threadId > 0) {
      return await commentsApi.getComments(threadId);
    }
    return await commentsApi.getCommentsByTravel(travelId);
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
