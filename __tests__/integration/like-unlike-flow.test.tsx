import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentItem } from '@/components/travel/CommentItem';
import { useLikeComment, useUnlikeComment, useDeleteComment, useThread, useComments } from '@/hooks/useComments';
import { useAuth } from '@/context/AuthContext';
import type { TravelComment } from '@/types/comments';

jest.mock('@/hooks/useComments');
jest.mock('@/context/AuthContext');

const mockUseLikeComment = useLikeComment as jest.MockedFunction<typeof useLikeComment>;
const mockUseUnlikeComment = useUnlikeComment as jest.MockedFunction<typeof useUnlikeComment>;
const mockUseDeleteComment = useDeleteComment as jest.MockedFunction<typeof useDeleteComment>;
const mockUseThread = useThread as jest.MockedFunction<typeof useThread>;
const mockUseComments = useComments as jest.MockedFunction<typeof useComments>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Like/Unlike Flow Integration', () => {
  let queryClient: QueryClient;
  let likeMock: jest.Mock;
  let unlikeMock: jest.Mock;

  const mockComment: TravelComment = {
    id: 1,
    thread: 1,
    sub_thread: null,
    user: 2,
    text: 'Test comment',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    likes_count: 0,
    user_name: 'Test User',
    is_liked: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    likeMock = jest.fn();
    unlikeMock = jest.fn();

    mockUseLikeComment.mockReturnValue({
      mutate: likeMock,
      isPending: false,
    } as any);

    mockUseUnlikeComment.mockReturnValue({
      mutate: unlikeMock,
      isPending: false,
    } as any);

    mockUseDeleteComment.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockUseThread.mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    mockUseComments.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: '2',
      username: 'testuser',
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should like comment and increase count from 0 to 1', async () => {
    const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

    // Начальное состояние: лайков 0, не лайкнуто
    expect(screen.queryByText('0')).toBeNull(); // Счетчик не показывается при 0 лайках

    // Нажимаем "Поставить лайк"
    const likeButton = screen.getByLabelText('Поставить лайк');
    fireEvent.press(likeButton);

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith(1);
      expect(unlikeMock).not.toHaveBeenCalled();
    });

    // Симулируем обновление данных после лайка
    const likedComment = { ...mockComment, likes_count: 1, is_liked: true };
    rerender(<CommentItem comment={likedComment} />);

    // Проверяем, что счетчик показывает 1
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByLabelText('Убрать лайк')).toBeTruthy();
  });

  it('should unlike comment and decrease count from 1 to 0', async () => {
    const likedComment = { ...mockComment, likes_count: 1, is_liked: true };
    const { rerender } = render(<CommentItem comment={likedComment} />, { wrapper });

    // Начальное состояние: 1 лайк, лайкнуто
    expect(screen.getByText('1')).toBeTruthy();

    // Нажимаем "Убрать лайк"
    const unlikeButton = screen.getByLabelText('Убрать лайк');
    fireEvent.press(unlikeButton);

    await waitFor(() => {
      expect(unlikeMock).toHaveBeenCalledWith(1);
      expect(likeMock).not.toHaveBeenCalled();
    });

    // Симулируем обновление данных после удаления лайка
    const unlikedComment = { ...mockComment, likes_count: 0, is_liked: false };
    rerender(<CommentItem comment={unlikedComment} />);

    // Проверяем, что счетчик исчез (не показывается при 0 лайках)
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();
  });

  it('should complete full cycle: like (0→1) then unlike (1→0)', async () => {
    const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

    // Шаг 1: Начальное состояние - 0 лайков
    expect(screen.queryByText('0')).toBeNull();
    const likeButton1 = screen.getByLabelText('Поставить лайк');

    // Шаг 2: Ставим лайк
    fireEvent.press(likeButton1);

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledTimes(1);
      expect(likeMock).toHaveBeenCalledWith(1);
    });

    // Шаг 3: Обновляем данные - теперь 1 лайк
    const likedComment = { ...mockComment, likes_count: 1, is_liked: true };
    rerender(<CommentItem comment={likedComment} />);

    expect(screen.getByText('1')).toBeTruthy();
    const unlikeButton = screen.getByLabelText('Убрать лайк');

    // Шаг 4: Убираем лайк
    fireEvent.press(unlikeButton);

    await waitFor(() => {
      expect(unlikeMock).toHaveBeenCalledTimes(1);
      expect(unlikeMock).toHaveBeenCalledWith(1);
      expect(likeMock).toHaveBeenCalledTimes(1); // Не должен вызываться повторно
    });

    // Шаг 5: Обновляем данные - теперь 0 лайков
    const unlikedComment = { ...mockComment, likes_count: 0, is_liked: false };
    rerender(<CommentItem comment={unlikedComment} />);

    // Проверяем финальное состояние
    expect(screen.queryByText('0')).toBeNull(); // Счетчик не показывается
    expect(screen.queryByText('1')).toBeNull(); // 1 тоже нет
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy(); // Кнопка снова "Поставить лайк"
  });

  it('should handle multiple likes and unlikes correctly', async () => {
    const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

    // Цикл 1: Like
    fireEvent.press(screen.getByLabelText('Поставить лайк'));
    await waitFor(() => expect(likeMock).toHaveBeenCalledTimes(1));

    rerender(<CommentItem comment={{ ...mockComment, likes_count: 1, is_liked: true }} />);

    // Цикл 1: Unlike
    fireEvent.press(screen.getByLabelText('Убрать лайк'));
    await waitFor(() => expect(unlikeMock).toHaveBeenCalledTimes(1));

    rerender(<CommentItem comment={{ ...mockComment, likes_count: 0, is_liked: false }} />);

    // Цикл 2: Like снова
    fireEvent.press(screen.getByLabelText('Поставить лайк'));
    await waitFor(() => expect(likeMock).toHaveBeenCalledTimes(2));

    rerender(<CommentItem comment={{ ...mockComment, likes_count: 1, is_liked: true }} />);

    // Цикл 2: Unlike снова
    fireEvent.press(screen.getByLabelText('Убрать лайк'));
    await waitFor(() => expect(unlikeMock).toHaveBeenCalledTimes(2));

    // Финальная проверка
    expect(likeMock).toHaveBeenCalledTimes(2);
    expect(unlikeMock).toHaveBeenCalledTimes(2);
  });

  it('should ensure is_liked state is correct after each operation', async () => {
    const { rerender } = render(<CommentItem comment={mockComment} />, { wrapper });

    // Проверка 1: Изначально не лайкнуто
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();
    expect(screen.queryByLabelText('Убрать лайк')).toBeNull();

    // Ставим лайк
    fireEvent.press(screen.getByLabelText('Поставить лайк'));
    await waitFor(() => expect(likeMock).toHaveBeenCalled());

    // Проверка 2: После лайка is_liked должен быть true
    rerender(<CommentItem comment={{ ...mockComment, likes_count: 1, is_liked: true }} />);
    expect(screen.queryByLabelText('Поставить лайк')).toBeNull();
    expect(screen.getByLabelText('Убрать лайк')).toBeTruthy();

    // Убираем лайк
    fireEvent.press(screen.getByLabelText('Убрать лайк'));
    await waitFor(() => expect(unlikeMock).toHaveBeenCalled());

    // Проверка 3: После удаления лайка is_liked должен быть false
    rerender(<CommentItem comment={{ ...mockComment, likes_count: 0, is_liked: false }} />);
    expect(screen.getByLabelText('Поставить лайк')).toBeTruthy();
    expect(screen.queryByLabelText('Убрать лайк')).toBeNull();
  });
});
