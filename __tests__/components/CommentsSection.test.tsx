import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentsSection } from '@/components/travel/CommentsSection';
import {
  useMainThread,
  useTravelComments,
  useCreateComment,
  useUpdateComment,
  useReplyToComment,
  useLikeComment,
  useUnlikeComment,
  useDeleteComment,
} from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/api/client';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');

const mockUseMainThread = useMainThread as jest.MockedFunction<typeof useMainThread>;
const mockUseTravelComments = useTravelComments as jest.MockedFunction<typeof useTravelComments>;
const mockUseCreateComment = useCreateComment as jest.MockedFunction<typeof useCreateComment>;
const mockUseUpdateComment = useUpdateComment as jest.MockedFunction<typeof useUpdateComment>;
const mockUseReplyToComment = useReplyToComment as jest.MockedFunction<typeof useReplyToComment>;
const mockUseLikeComment = useLikeComment as jest.MockedFunction<typeof useLikeComment>;
const mockUseUnlikeComment = useUnlikeComment as jest.MockedFunction<typeof useUnlikeComment>;
const mockUseDeleteComment = useDeleteComment as jest.MockedFunction<typeof useDeleteComment>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('CommentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseUpdateComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseReplyToComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseLikeComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseUnlikeComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
    mockUseDeleteComment.mockReturnValue({ mutate: jest.fn(), isPending: false } as any);
  });

  describe('Unauthenticated users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        userId: null,
        username: '',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });

      mockUseMainThread.mockReturnValue({
        data: { id: 1, travel: 123, is_main: true, created_at: null, updated_at: null },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [
          {
            id: 1,
            thread: 1,
            sub_thread: null,
            user: 2,
            text: 'Test comment',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            likes_count: 5,
            user_name: 'Test User',
          },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);
    });

    it('should show login prompt', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Войдите, чтобы оставить комментарий')).toBeTruthy();
    });

    it('should not show comment form', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.queryByPlaceholderText('Написать комментарий...')).toBeNull();
    });

    it('should display existing comments', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Test comment')).toBeTruthy();
      expect(screen.getByText('Test User')).toBeTruthy();
    });
  });

  describe('Authenticated users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '1',
        username: 'Current User',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });

      mockUseMainThread.mockReturnValue({
        data: { id: 1, travel: 123, is_main: true, created_at: null, updated_at: null },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseCreateComment.mockReturnValue({
        mutate: jest.fn(),
        isPending: false,
      } as any);
    });

    it('should show comment form', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByPlaceholderText('Написать комментарий...')).toBeTruthy();
    });

    it('should not show login prompt', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.queryByText('Войдите, чтобы оставить комментарий')).toBeNull();
    });

    it('should handle comment submission', async () => {
      const mutateMock = jest.fn();
      mockUseCreateComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      const input = screen.getByPlaceholderText('Написать комментарий...');
      const submitButton = screen.getByLabelText('Отправить комментарий');

      fireEvent.changeText(input, 'New comment');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith({
          text: 'New comment',
          thread_id: 1,
        });
      });
    });
  });

  describe('Loading states', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '1',
        username: 'User',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });
    });

    it('should show loading indicator when fetching thread', () => {
      mockUseMainThread.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByTestId('comments-skeleton')).toBeTruthy();
    });

    it('should show empty state when thread errors but comments load fine', () => {
      mockUseMainThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Пока нет комментариев')).toBeTruthy();
      expect(screen.queryByText('Комментарии недоступны')).toBeNull();
    });

    it('should show error message when comments fail to load', () => {
      mockUseMainThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('Network error'),
        refetch: jest.fn(),
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Комментарии недоступны')).toBeTruthy();
    });

    it('should show login prompt and empty state on 401 thread error (comments are public)', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        userId: null,
        username: '',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });

      mockUseMainThread.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new ApiError(401, 'Требуется авторизация'),
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Войдите, чтобы оставить комментарий')).toBeTruthy();
      expect(screen.getByText('Пока нет комментариев')).toBeTruthy();
      expect(screen.queryByText('Комментарии недоступны')).toBeNull();
    });
  });

  describe('Empty state', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '1',
        username: 'User',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });

      mockUseMainThread.mockReturnValue({
        data: { id: 1, travel: 123, is_main: true, created_at: null, updated_at: null },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      mockUseTravelComments.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);
    });

    it('should show empty state when no comments', () => {
      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Пока нет комментариев')).toBeTruthy();
      expect(screen.getByText('Будьте первым, кто оставит комментарий!')).toBeTruthy();
    });
  });

  describe('Comment organization', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '1',
        username: 'User',
        isSuperuser: false,
        userAvatar: null,
        authReady: true,
        profileRefreshToken: 0,
        setIsAuthenticated: jest.fn(),
        setUsername: jest.fn(),
        setIsSuperuser: jest.fn(),
        setUserId: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
        logout: jest.fn(),
        login: jest.fn(),
        sendPassword: jest.fn(),
        setNewPassword: jest.fn(),
      });

      mockUseMainThread.mockReturnValue({
        data: { id: 1, travel: 123, is_main: true, created_at: null, updated_at: null },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);
    });

    it('should organize comments into top-level and replies', () => {
      mockUseTravelComments.mockReturnValue({
        data: [
          {
            id: 1,
            thread: 1,
            sub_thread: null,
            user: 1,
            text: 'Top level comment',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            likes_count: 0,
          },
          {
            id: 2,
            thread: 1,
            sub_thread: 1,
            user: 2,
            text: 'Reply to comment 1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            likes_count: 0,
          },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      render(<CommentsSection travelId={123} />, { wrapper });

      expect(screen.getByText('Top level comment')).toBeTruthy();
      // Replies are collapsed by default; the UI shows the toggle with count.
      expect(screen.getByText('Показать ответы (1)')).toBeTruthy();
      expect(screen.queryByText('Reply to comment 1')).toBeNull();
    });
  });
});
