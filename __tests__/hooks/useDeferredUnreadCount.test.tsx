import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { createTestQueryClient } from '../helpers/testQueryClient';

const mockFetchUnreadCount = jest.fn();

jest.mock('@/api/messages', () => ({
  fetchUnreadCount: (...args: unknown[]) => mockFetchUnreadCount(...args),
}));

import { useDeferredUnreadCount } from '@/hooks/useDeferredUnreadCount';
import { useAuthStore } from '@/stores/authStore';

/**
 * Оба вызывающих (меню аккаунта и экран профиля) должны ходить по одному ключу
 * общего слоя данных: до #1661 механизмов было два, и открытие меню на экране
 * профиля заказывало то же число заново.
 */
const renderShared = (
  args: Array<[boolean, boolean]>,
): { unmount: () => void } => {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => args.map(([enabled, poll]) => useDeferredUnreadCount(enabled, poll)), {
    wrapper: Wrapper,
  });
};

describe('useDeferredUnreadCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchUnreadCount.mockResolvedValue({ count: 4 });
    useAuthStore.setState({ userId: '7' });
  });

  it('does not go to the network while the caller keeps it disabled', async () => {
    const { result } = renderHook(() => useDeferredUnreadCount(false, false), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {});

    expect(mockFetchUnreadCount).not.toHaveBeenCalled();
    expect(result.current.count).toBe(0);
  });

  // Ровно тот дефект, ради которого заведена #1661: два вызывающих — один запрос.
  it('serves both callers from one shared request', async () => {
    const { result } = renderShared([
      [true, true],
      [true, false],
    ]);

    await waitFor(() => expect(result.current[0].count).toBe(4));

    expect(mockFetchUnreadCount).toHaveBeenCalledTimes(1);
    expect(result.current[1].count).toBe(4);
  });

  // Логаут кэш не чистит, поэтому число обязано быть привязано к пользователю.
  it('does not hand the next signed-in user the previous count', async () => {
    const queryClient = createTestQueryClient();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useDeferredUnreadCount(true, false), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.count).toBe(4));
    first.unmount();

    mockFetchUnreadCount.mockResolvedValue({ count: 0 });
    useAuthStore.setState({ userId: '9' });

    const second = renderHook(() => useDeferredUnreadCount(true, false), { wrapper: Wrapper });

    // Чужое число не подставляется даже на первый кадр.
    expect(second.result.current.count).toBe(0);
    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalledTimes(2));
    expect(second.result.current.count).toBe(0);
  });

  it('falls back to zero when the endpoint fails', async () => {
    mockFetchUnreadCount.mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useDeferredUnreadCount(true, false), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalled());

    expect(result.current.count).toBe(0);
  });
});
