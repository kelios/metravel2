import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SyncIndicator } from '@/components/ui/SyncIndicator';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

describe('SyncIndicator', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('keeps the compact offline banner non-blocking outside its saved-content action', () => {
    const { getByLabelText, getByText } = render(<SyncIndicator />);
    const banner = getByLabelText('Нет сети. Сохранённые материалы доступны.');
    const message = getByText('Нет сети. Сохранённые материалы доступны.');
    const action = getByLabelText('Открыть сохранённое');

    expect(banner.props.pointerEvents).toBe('box-none');
    expect(banner.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ top: 24 }),
    ]));
    expect(message.props.numberOfLines).toBe(2);
    expect(action).toBeTruthy();

    fireEvent.press(action);
    expect(mockPush).toHaveBeenCalledWith('/offline');
  });
});
