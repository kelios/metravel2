import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentItem } from '@/components/travel/CommentItem';
import { useLikeComment, useUnlikeComment, useDeleteComment } from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';
import type { TravelComment } from '@/types/comments';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');

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

const mockComment: TravelComment = {
  id: 1,
  thread: 1,
  sub_thread: null,
  user: 2,
  text: 'Test comment text',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  likes_count: 5,
  user_name: 'Test User',
  is_liked: false,
};

describe('CommentItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLikeComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockUseDeleteComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  describe('Display', () => {
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
    });

    it('should render comment text', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByText('Test comment text')).toBeTruthy();
    });

    it('should render user name', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByText('Test User')).toBeTruthy();
    });

    it('should render likes count', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('should render user avatar with first letter', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByText('T')).toBeTruthy();
    });
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
    });

    it('should not show like button', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.queryByLabelText('Поставить лайк')).toBeNull();
    });

    it('should not show reply button', () => {
      const onReply = jest.fn();
      render(<CommentItem comment={mockComment} onReply={onReply} />, { wrapper });
      expect(screen.queryByLabelText('Ответить на комментарий')).toBeNull();
    });

    it('should not show action buttons', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.queryByLabelText('Действия с комментарием')).toBeNull();
    });

    it('should show likes count as static text', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  describe('Authenticated users - not author', () => {
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
    });

    it('should show like button', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();
    });

    it('should show reply button when onReply provided', () => {
      const onReply = jest.fn();
      render(<CommentItem comment={mockComment} onReply={onReply} />, { wrapper });
      expect(screen.getByLabelText('Ответить на комментарий')).toBeTruthy();
    });

    it('should not show action menu for other users comments', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.queryByLabelText('Действия с комментарием')).toBeNull();
    });

    it('should handle like action', async () => {
      const mutateMock = jest.fn();
      mockUseLikeComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const likeButton = screen.getByLabelText('Поставить лайк');
      fireEvent.press(likeButton);

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(1);
      });
    });

    it('should handle unlike action', async () => {
      const mutateMock = jest.fn();
      mockUseUnlikeComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      const likedComment = { ...mockComment, is_liked: true };
      render(<CommentItem comment={likedComment} />, { wrapper });
      
      const likeButton = screen.getByLabelText('Убрать лайк');
      fireEvent.press(likeButton);

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(1);
      });
    });

    it('should call onReply when reply button pressed', () => {
      const onReply = jest.fn();
      render(<CommentItem comment={mockComment} onReply={onReply} />, { wrapper });
      
      const replyButton = screen.getByLabelText('Ответить на комментарий');
      fireEvent.press(replyButton);

      expect(onReply).toHaveBeenCalledWith(mockComment);
    });

    it('should not show reply button at level 2', () => {
      const onReply = jest.fn();
      render(<CommentItem comment={mockComment} onReply={onReply} level={2} />, { wrapper });
      
      expect(screen.queryByLabelText('Ответить на комментарий')).toBeNull();
    });
  });

  describe('Authenticated users - author', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '2',
        username: 'Test User',
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

    it('should show action menu button', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByLabelText('Действия с комментарием')).toBeTruthy();
    });

    it('should show edit and delete buttons when menu opened', () => {
      const onEdit = jest.fn();
      render(<CommentItem comment={mockComment} onEdit={onEdit} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      expect(screen.getByLabelText('Редактировать комментарий')).toBeTruthy();
      expect(screen.getByLabelText('Удалить комментарий')).toBeTruthy();
    });

    it('should call onEdit when edit button pressed', () => {
      const onEdit = jest.fn();
      render(<CommentItem comment={mockComment} onEdit={onEdit} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      const editButton = screen.getByLabelText('Редактировать комментарий');
      fireEvent.press(editButton);

      expect(onEdit).toHaveBeenCalledWith(mockComment);
    });

    it('should handle delete with confirmation', async () => {
      const Alert = require('react-native').Alert;
      Alert.alert = jest.fn((title, message, buttons) => {
        // Симулируем нажатие кнопки "Удалить"
        buttons[1].onPress();
      });

      const mutateMock = jest.fn();
      mockUseDeleteComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      const deleteButton = screen.getByLabelText('Удалить комментарий');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
        expect(mutateMock).toHaveBeenCalledWith(1);
      });
    });

    it('should not delete if confirmation cancelled', async () => {
      const Alert = require('react-native').Alert;
      Alert.alert = jest.fn((_title, _message, _buttons) => {
        // Симулируем нажатие кнопки "Отмена"
        // Не вызываем никакой callback
      });

      const mutateMock = jest.fn();
      mockUseDeleteComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      const deleteButton = screen.getByLabelText('Удалить комментарий');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
        expect(mutateMock).not.toHaveBeenCalled();
      });
    });

    it('should be able to unlike own liked comment', async () => {
      const unlikeMock = jest.fn();
      const likeMock = jest.fn();

      mockUseUnlikeComment.mockReturnValue({
        mutate: unlikeMock,
        isPending: false,
      } as any);

      mockUseLikeComment.mockReturnValue({
        mutate: likeMock,
        isPending: false,
      } as any);

      const likedComment = { ...mockComment, is_liked: true };
      render(<CommentItem comment={likedComment} />, { wrapper });

      const unlikeButton = screen.getByLabelText('Убрать лайк');
      fireEvent.press(unlikeButton);

      await waitFor(() => {
        expect(unlikeMock).toHaveBeenCalledWith(1);
        expect(likeMock).not.toHaveBeenCalled(); // Проверяем что НЕ вызывается like
      });
    });

    it('should toggle between like and unlike correctly', async () => {
      const unlikeMock = jest.fn();
      const likeMock = jest.fn();

      mockUseUnlikeComment.mockReturnValue({
        mutate: unlikeMock,
        isPending: false,
      } as any);

      mockUseLikeComment.mockReturnValue({
        mutate: likeMock,
        isPending: false,
      } as any);

      // Сначала комментарий не лайкнут
      const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

      const likeButton = screen.getByLabelText('Поставить лайк');
      fireEvent.press(likeButton);

      await waitFor(() => {
        expect(likeMock).toHaveBeenCalledWith(1);
        expect(unlikeMock).not.toHaveBeenCalled();
      });

      // Теперь симулируем что комментарий лайкнут
      const likedComment = { ...mockComment, is_liked: true };
      rerender(<CommentItem comment={likedComment} />);

      const unlikeButton = screen.getByLabelText('Убрать лайк');
      fireEvent.press(unlikeButton);

      await waitFor(() => {
        expect(unlikeMock).toHaveBeenCalledWith(1);
        // likeMock уже был вызван 1 раз, проверяем что больше не вызывается
        expect(likeMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Admin users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '999',
        username: 'Admin User',
        isSuperuser: true,
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

    it('should show action menu for any comment', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      expect(screen.getByLabelText('Действия с комментарием')).toBeTruthy();
    });

    it('should show delete button for other users comments', () => {
      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      // Кнопка удаления отображается как иконка, проверяем по accessibility label
      expect(screen.getByLabelText('Удалить комментарий')).toBeTruthy();
    });

    it('should not show edit button for other users comments', () => {
      const onEdit = jest.fn();
      render(<CommentItem comment={mockComment} onEdit={onEdit} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      expect(screen.queryByLabelText('Редактировать комментарий')).toBeNull();
    });

    it('should be able to delete any comment', async () => {
      const Alert = require('react-native').Alert;
      Alert.alert = jest.fn((title, message, buttons) => {
        // Симулируем нажатие кнопки "Удалить"
        buttons[1].onPress();
      });

      const mutateMock = jest.fn();
      mockUseDeleteComment.mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      const deleteButton = screen.getByLabelText('Удалить комментарий');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Nested comments', () => {
    it('should apply nested styling at level 1', () => {
      const { getByTestId } = render(
        <CommentItem comment={mockComment} level={1} />,
        { wrapper }
      );
      
      const container = getByTestId('comment-item');
      expect(container.props.style).toContainEqual(expect.objectContaining({
        marginLeft: 40,
      }));
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

    it('should disable like button while liking', () => {
      mockUseLikeComment.mockReturnValue({
        mutate: jest.fn(),
        isPending: true,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const likeButton = screen.getByLabelText('Поставить лайк');
      expect(likeButton.props.disabled).toBe(true);
    });

    it('should show loading indicator while deleting', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '2',
        username: 'Test User',
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

      mockUseDeleteComment.mockReturnValue({
        mutate: jest.fn(),
        isPending: true,
      } as any);

      render(<CommentItem comment={mockComment} />, { wrapper });
      
      const menuButton = screen.getByLabelText('Действия с комментарием');
      fireEvent.press(menuButton);

      expect(screen.getByTestId('activity-indicator')).toBeTruthy();
    });
  });
});
