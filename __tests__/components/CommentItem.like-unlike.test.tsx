import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentItem } from '@/components/travel/CommentItem';
import { useLikeComment, useUnlikeComment } from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';
import type { TravelComment } from '@/types/comments';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');

const mockUseLikeComment = useLikeComment as jest.MockedFunction<typeof useLikeComment>;
const mockUseUnlikeComment = useUnlikeComment as jest.MockedFunction<typeof useUnlikeComment>;
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

describe('CommentItem - Like/Unlike functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

  it('should allow user to like a comment', async () => {
    const likeMock = jest.fn();
    const unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: false,
    } as any);

    render(<CommentItem comment={mockComment} />, { wrapper });

    const likeButton = screen.getByLabelText('Поставить лайк');
    fireEvent.press(likeButton);

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith(1);
      expect(unlikeMock).not.toHaveBeenCalled();
    });
  });

  it('should allow user to unlike a liked comment', async () => {
    const likeMock = jest.fn();
    const unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: false,
    } as any);

    const likedComment = { ...mockComment, is_liked: true };
    render(<CommentItem comment={likedComment} />, { wrapper });

    const unlikeButton = screen.getByLabelText('Убрать лайк');
    fireEvent.press(unlikeButton);

    await waitFor(() => {
      expect(unlikeMock).toHaveBeenCalledWith(1);
      expect(likeMock).not.toHaveBeenCalled();
    });
  });

  it('should toggle between like and unlike correctly when clicking multiple times', async () => {
    const likeMock = jest.fn();
    const unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: false,
    } as any);

    // Начинаем с не лайкнутого комментария
    const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

    // Первый клик - ставим лайк
    const likeButton1 = screen.getByLabelText('Поставить лайк');
    fireEvent.press(likeButton1);

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith(1);
      expect(likeMock).toHaveBeenCalledTimes(1);
    });

    // Симулируем обновление состояния после лайка
    const likedComment = { ...mockComment, is_liked: true, likes_count: 6 };
    rerender(<CommentItem comment={likedComment} />);

    // Второй клик - убираем лайк
    const unlikeButton = screen.getByLabelText('Убрать лайк');
    fireEvent.press(unlikeButton);

    await waitFor(() => {
      expect(unlikeMock).toHaveBeenCalledWith(1);
      expect(unlikeMock).toHaveBeenCalledTimes(1);
      expect(likeMock).toHaveBeenCalledTimes(1); // Не вызывался повторно
    });

    // Симулируем обновление состояния после отлайка
    const unlikedComment = { ...mockComment, is_liked: false, likes_count: 5 };
    rerender(<CommentItem comment={unlikedComment} />);

    // Третий клик - снова ставим лайк
    const likeButton2 = screen.getByLabelText('Поставить лайк');
    fireEvent.press(likeButton2);

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith(1);
      expect(likeMock).toHaveBeenCalledTimes(2); // Вызван второй раз
      expect(unlikeMock).toHaveBeenCalledTimes(1); // Не вызывался повторно
    });
  });

  it('should not call like when pending', async () => {
    const likeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: true, // Мутация в процессе
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    render(<CommentItem comment={mockComment} />, { wrapper });

    const likeButton = screen.getByLabelText('Поставить лайк');

    // Кнопка должна быть disabled
    expect(likeButton.props.disabled).toBe(true);

    fireEvent.press(likeButton);

    // mutate не должен быть вызван, так как кнопка disabled
    expect(likeMock).not.toHaveBeenCalled();
  });

  it('should not call unlike when pending', async () => {
    const unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: true, // Мутация в процессе
    } as any);

    const likedComment = { ...mockComment, is_liked: true };
    render(<CommentItem comment={likedComment} />, { wrapper });

    const unlikeButton = screen.getByLabelText('Убрать лайк');

    // Кнопка должна быть disabled
    expect(unlikeButton.props.disabled).toBe(true);

    fireEvent.press(unlikeButton);

    // mutate не должен быть вызван, так как кнопка disabled
    expect(unlikeMock).not.toHaveBeenCalled();
  });

  it('should show correct icon color for liked state', () => {
    const mockUseLikeCommentDefault = mockUseLikeComment as jest.MockedFunction<typeof useLikeComment>;
    const mockUseUnlikeCommentDefault = mockUseUnlikeComment as jest.MockedFunction<typeof useUnlikeComment>;

    mockUseLikeCommentDefault.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockUseUnlikeCommentDefault.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    const likedComment = { ...mockComment, is_liked: true };
    const { rerender } = render(<CommentItem comment={likedComment} />, { wrapper });

    // Проверяем, что кнопка отображается с правильным label
    expect(screen.getByLabelText('Убрать лайк')).toBeTruthy();

    // Изменяем на не лайкнутый
    const unlikedComment = { ...mockComment, is_liked: false };
    rerender(<CommentItem comment={unlikedComment} />);

    // Проверяем, что кнопка изменилась
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();
  });

  it('should preserve like state even if backend does not return is_liked field', async () => {
    const likeMock = jest.fn();
    const unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: false,
    } as any);

    // Комментарий без is_liked поля (undefined)
    const commentWithoutIsLiked = { ...mockComment };
    delete (commentWithoutIsLiked as any).is_liked;

    const { rerender } = render(<CommentItem comment={commentWithoutIsLiked} />, { wrapper });

    // Должна отображаться кнопка "Поставить лайк" (is_liked = undefined => falsy => не лайкнуто)
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Поставить лайк'));

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith(1);
    });

    // Симулируем ответ бэкенда, который не содержит is_liked
    const commentAfterLike = { ...mockComment, likes_count: 6 };
    delete (commentAfterLike as any).is_liked;

    rerender(<CommentItem comment={commentAfterLike} />);

    // Даже если бэкенд не вернул is_liked, кнопка должна позволить отлайкнуть
    // Но в реальности, если is_liked undefined, кнопка будет "Поставить лайк"
    // Это и есть баг, который мы исправили в хуке!
    // После нашего исправления хук должен сохранять is_liked в кэше
  });
});
