import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NetworkStatus } from '@/components/ui/NetworkStatus.web';

const mockPush = jest.fn();
const mockIsConnected = jest.fn(() => false);
const mockPreloadOfflineRoute = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected() }),
}));

jest.mock('@/utils/offlineRoutePreload.web', () => ({
  preloadOfflineRoute: () => mockPreloadOfflineRoute(),
}));

describe('NetworkStatus web offline banner', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockIsConnected.mockReturnValue(false);
    mockPreloadOfflineRoute.mockClear();
  });

  it('does not intercept loaded-shell controls outside its action', () => {
    const { getByTestId, getByText } = render(<NetworkStatus />);

    expect(getByTestId('network-status-banner').props.pointerEvents).toBe('box-none');
    expect(getByText('Нет подключения к интернету').props.numberOfLines).toBe(2);
    expect(getByText('Открыть сохранённое').props.numberOfLines).toBe(1);
  });

  it('preloads the library module while the loaded shell is online', async () => {
    mockIsConnected.mockReturnValue(true);
    render(<NetworkStatus />);

    expect(mockPreloadOfflineRoute).toHaveBeenCalledTimes(1);
  });

  it('opens the prefetched library without propagating the mobile tap', async () => {
    mockIsConnected.mockReturnValue(true);
    const view = render(<NetworkStatus />);

    await waitFor(() => expect(mockPreloadOfflineRoute).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());

    mockIsConnected.mockReturnValue(false);
    view.rerender(<NetworkStatus />);

    const stopPropagation = jest.fn();
    const preventDefault = jest.fn();
    fireEvent(view.getByText('Открыть сохранённое'), 'press', {
      stopPropagation,
      preventDefault,
    });
    fireEvent(view.getByText('Открыть сохранённое'), 'press', {
      stopPropagation,
      preventDefault,
    });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/offline');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
