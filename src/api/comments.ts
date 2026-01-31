import { apiClient } from './client';
import type {
  TravelComment,
  TravelCommentThread,
  TravelCommentCreate,
  TravelCommentUpdate,
} from '../../types/comments';

export const commentsApi = {
  getMainThread: async (travelId: number): Promise<TravelCommentThread> => {
    return await apiClient.get<TravelCommentThread>(
      `/travel-comment-threads/main/?travel_id=${travelId}`
    );
  },

  getThread: async (threadId: number): Promise<TravelCommentThread> => {
    return await apiClient.get<TravelCommentThread>(
      `/travel-comment-threads/${threadId}/`
    );
  },

  getComments: async (threadId: number): Promise<TravelComment[]> => {
    return await apiClient.get<TravelComment[]>(
      `/travel-comments/?thread_id=${threadId}`
    );
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
