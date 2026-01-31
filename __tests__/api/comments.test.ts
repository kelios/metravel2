import { commentsApi } from '@/src/api/comments';
import { apiClient } from '@/src/api/client';
import type { TravelComment, TravelCommentThread } from '@/types/comments';

jest.mock('@/src/api/client');

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Comments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMainThread', () => {
    it('should fetch main thread for travel', async () => {
      const mockThread: TravelCommentThread = {
        id: 1,
        travel: 123,
        is_main: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockedApiClient.get.mockResolvedValueOnce(mockThread);

      const result = await commentsApi.getMainThread(123);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/travel-comment-threads/main/?travel_id=123'
      );
      expect(result).toEqual(mockThread);
    });
  });

  describe('getComments', () => {
    it('should fetch comments for thread', async () => {
      const mockComments: TravelComment[] = [
        {
          id: 1,
          thread: 1,
          sub_thread: null,
          user: 1,
          text: 'Test comment',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          likes_count: 5,
        },
      ];

      mockedApiClient.get.mockResolvedValueOnce(mockComments);

      const result = await commentsApi.getComments(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/travel-comments/?thread_id=1'
      );
      expect(result).toEqual(mockComments);
    });
  });

  describe('createComment', () => {
    it('should create comment with travel_id', async () => {
      const newComment = {
        travel_id: 123,
        text: 'New comment',
      };

      const mockResponse: TravelComment = {
        id: 1,
        thread: 1,
        sub_thread: null,
        user: 1,
        text: 'New comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        likes_count: 0,
      };

      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await commentsApi.createComment(newComment);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/travel-comments/', newComment);
      expect(result).toEqual(mockResponse);
    });

    it('should create comment with thread_id', async () => {
      const newComment = {
        thread_id: 1,
        text: 'New comment',
      };

      const mockResponse: TravelComment = {
        id: 2,
        thread: 1,
        sub_thread: null,
        user: 1,
        text: 'New comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        likes_count: 0,
      };

      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await commentsApi.createComment(newComment);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/travel-comments/', newComment);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateComment', () => {
    it('should update comment text', async () => {
      const updateData = { text: 'Updated text' };
      const mockResponse: TravelComment = {
        id: 1,
        thread: 1,
        sub_thread: null,
        user: 1,
        text: 'Updated text',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        likes_count: 0,
      };

      mockedApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await commentsApi.updateComment(1, updateData);

      expect(mockedApiClient.put).toHaveBeenCalledWith('/travel-comments/1/', updateData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment', async () => {
      mockedApiClient.delete.mockResolvedValueOnce(undefined);

      await commentsApi.deleteComment(1);

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/travel-comments/1/');
    });
  });

  describe('likeComment', () => {
    it('should like comment', async () => {
      const mockResponse: TravelComment = {
        id: 1,
        thread: 1,
        sub_thread: null,
        user: 1,
        text: 'Test comment',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        likes_count: 6,
        is_liked: true,
      };

      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await commentsApi.likeComment(1);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/travel-comments/1/like/', {});
      expect(result).toEqual(mockResponse);
    });
  });

  describe('unlikeComment', () => {
    it('should unlike comment', async () => {
      mockedApiClient.delete.mockResolvedValueOnce(undefined);

      await commentsApi.unlikeComment(1);

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/travel-comments/1/like/');
    });
  });

  describe('replyToComment', () => {
    it('should reply to comment', async () => {
      const replyData = { text: 'Reply text' };
      const mockResponse: TravelComment = {
        id: 2,
        thread: 1,
        sub_thread: 2,
        user: 1,
        text: 'Reply text',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        likes_count: 0,
      };

      mockedApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await commentsApi.replyToComment(1, replyData);

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/travel-comments/1/reply/',
        replyData
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockedApiClient.get.mockRejectedValueOnce(error);

      await expect(commentsApi.getComments(1)).rejects.toThrow('Network error');
    });

    it('should handle 404 errors', async () => {
      const error = { response: { status: 404 } };
      mockedApiClient.get.mockRejectedValueOnce(error);

      await expect(commentsApi.getComment(999)).rejects.toEqual(error);
    });

    it('should handle 403 errors for unauthorized actions', async () => {
      const error = { response: { status: 403 } };
      mockedApiClient.delete.mockRejectedValueOnce(error);

      await expect(commentsApi.deleteComment(1)).rejects.toEqual(error);
    });
  });
});
