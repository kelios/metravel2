import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLikeComment, useUnlikeComment, useTravelComments, commentKeys } from '@/hooks/useComments';
import { commentsApi } from '@/src/api/comments';
import type { TravelComment } from '@/types/comments';
import React from 'react';

jest.mock('@/src/api/comments');

const mockedCommentsApi = commentsApi as jest.Mocked<typeof commentsApi>;

const mockComment: TravelComment = {
  id: 1,
  thread: 1,
  sub_thread: null,
  user: 2,
  text: 'Test comment',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  likes_count: 5,
  user_name: 'Test User',
  is_liked: false,
};

describe('useComments - Like/Unlike integration', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should preserve is_liked state after liking even if backend does not return it', async () => {
    // Мокируем API ответы
    mockedCommentsApi.getTravelComments = jest.fn().mockResolvedValue([mockComment]);

    // Бэкенд возвращает комментарий БЕЗ поля is_liked при лайке
    const commentWithoutIsLiked = { ...mockComment, likes_count: 6 };
    delete (commentWithoutIsLiked as any).is_liked;
    mockedCommentsApi.likeComment = jest.fn().mockResolvedValue(commentWithoutIsLiked);

    // Загружаем комментарии
    const { result: commentsResult } = renderHook(
      () => useTravelComments(1, 1),
      { wrapper }
    );

    // Ждем загрузки
    await waitFor(() => {
      expect(commentsResult.current.isSuccess).toBe(true);
    });

    expect(commentsResult.current.data).toHaveLength(1);
    expect(commentsResult.current.data?.[0].is_liked).toBe(false);

    // Теперь лайкаем комментарий
    const { result: likeResult } = renderHook(
      () => useLikeComment(),
      { wrapper }
    );

    likeResult.current.mutate(1);

    // Ждем успешного выполнения мутации
    await waitFor(() => {
      expect(likeResult.current.isSuccess).toBe(true);
    });

    // Проверяем, что мутация была вызвана
    expect(mockedCommentsApi.likeComment).toHaveBeenCalledWith(1);

    // Получаем обновленные данные из кэша
    const cachedData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    // ВАЖНО: is_liked должно остаться true, даже если бэкенд не вернул его
    expect(cachedData).toBeDefined();
    expect(cachedData?.[0].is_liked).toBe(true);
    expect(cachedData?.[0].likes_count).toBe(6);
  });

  it('should preserve is_liked state after unliking even if backend does not return it', async () => {
    // Начинаем с лайкнутого комментария
    const likedComment = { ...mockComment, is_liked: true, likes_count: 6 };
    mockedCommentsApi.getTravelComments = jest.fn().mockResolvedValue([likedComment]);

    // Бэкенд не возвращает комментарий при отлайке (только 204 No Content)
    mockedCommentsApi.unlikeComment = jest.fn().mockResolvedValue(undefined);

    // Загружаем комментарии
    const { result: commentsResult } = renderHook(
      () => useTravelComments(1, 1),
      { wrapper }
    );

    await waitFor(() => {
      expect(commentsResult.current.isSuccess).toBe(true);
    });

    expect(commentsResult.current.data?.[0].is_liked).toBe(true);

    // Теперь отлайкаем комментарий
    const { result: unlikeResult } = renderHook(
      () => useUnlikeComment(),
      { wrapper }
    );

    unlikeResult.current.mutate(1);

    await waitFor(() => {
      expect(unlikeResult.current.isSuccess).toBe(true);
    });

    expect(mockedCommentsApi.unlikeComment).toHaveBeenCalledWith(1);

    // Получаем обновленные данные из кэша
    const cachedData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    // is_liked должно быть false
    expect(cachedData).toBeDefined();
    expect(cachedData?.[0].is_liked).toBe(false);
    expect(cachedData?.[0].likes_count).toBe(5);
  });

  it('should allow sequential like and unlike operations', async () => {
    mockedCommentsApi.getTravelComments = jest.fn().mockResolvedValue([mockComment]);

    const likedCommentResponse = { ...mockComment, likes_count: 6 };
    delete (likedCommentResponse as any).is_liked;
    mockedCommentsApi.likeComment = jest.fn().mockResolvedValue(likedCommentResponse);
    mockedCommentsApi.unlikeComment = jest.fn().mockResolvedValue(undefined);

    // Загружаем комментарии
    const { result: commentsResult } = renderHook(
      () => useTravelComments(1, 1),
      { wrapper }
    );

    await waitFor(() => {
      expect(commentsResult.current.isSuccess).toBe(true);
    });

    // Шаг 1: Лайкаем
    const { result: likeResult } = renderHook(
      () => useLikeComment(),
      { wrapper }
    );

    likeResult.current.mutate(1);

    await waitFor(() => {
      expect(likeResult.current.isSuccess).toBe(true);
    });

    let cachedData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(cachedData?.[0].is_liked).toBe(true);
    expect(cachedData?.[0].likes_count).toBe(6);

    // Шаг 2: Отлайкаем
    const { result: unlikeResult } = renderHook(
      () => useUnlikeComment(),
      { wrapper }
    );

    unlikeResult.current.mutate(1);

    await waitFor(() => {
      expect(unlikeResult.current.isSuccess).toBe(true);
    });

    cachedData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(cachedData?.[0].is_liked).toBe(false);
    expect(cachedData?.[0].likes_count).toBe(5);

    // Шаг 3: Снова лайкаем
    likeResult.current.mutate(1);

    await waitFor(() => {
      expect(likeResult.current.isSuccess).toBe(true);
    });

    cachedData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(cachedData?.[0].is_liked).toBe(true);
    expect(cachedData?.[0].likes_count).toBe(6);
  });

  it('should rollback optimistic update on like error', async () => {
    mockedCommentsApi.getTravelComments = jest.fn().mockResolvedValue([mockComment]);
    mockedCommentsApi.likeComment = jest.fn().mockRejectedValue(new Error('Network error'));

    // Загружаем комментарии
    const { result: commentsResult } = renderHook(
      () => useTravelComments(1, 1),
      { wrapper }
    );

    await waitFor(() => {
      expect(commentsResult.current.isSuccess).toBe(true);
    });

    const originalData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(originalData?.[0].is_liked).toBe(false);
    expect(originalData?.[0].likes_count).toBe(5);

    // Лайкаем с ошибкой
    const { result: likeResult } = renderHook(
      () => useLikeComment(),
      { wrapper }
    );

    likeResult.current.mutate(1);

    await waitFor(() => {
      expect(likeResult.current.isError).toBe(true);
    });

    // Данные должны откатиться к исходному состоянию
    const rolledBackData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(rolledBackData?.[0].is_liked).toBe(false);
    expect(rolledBackData?.[0].likes_count).toBe(5);
  });

  it('should rollback optimistic update on unlike error', async () => {
    const likedComment = { ...mockComment, is_liked: true, likes_count: 6 };
    mockedCommentsApi.getTravelComments = jest.fn().mockResolvedValue([likedComment]);
    mockedCommentsApi.unlikeComment = jest.fn().mockRejectedValue(new Error('Network error'));

    // Загружаем комментарии
    const { result: commentsResult } = renderHook(
      () => useTravelComments(1, 1),
      { wrapper }
    );

    await waitFor(() => {
      expect(commentsResult.current.isSuccess).toBe(true);
    });

    const originalData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(originalData?.[0].is_liked).toBe(true);
    expect(originalData?.[0].likes_count).toBe(6);

    // Отлайкаем с ошибкой
    const { result: unlikeResult } = renderHook(
      () => useUnlikeComment(),
      { wrapper }
    );

    unlikeResult.current.mutate(1);

    await waitFor(() => {
      expect(unlikeResult.current.isError).toBe(true);
    });

    // Данные должны откатиться к исходному состоянию
    const rolledBackData = queryClient.getQueryData<TravelComment[]>(
      commentKeys.travelComments(1, 1)
    );

    expect(rolledBackData?.[0].is_liked).toBe(true);
    expect(rolledBackData?.[0].likes_count).toBe(6);
  });
});
