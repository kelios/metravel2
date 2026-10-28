import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { BottomChromeInsetProvider } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { SyncIndicator } from '@/components/ui/SyncIndicator';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: false }),
}));

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 24, right: 0, bottom: 34, left: 0 }),
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

  it('keeps the offline saved-content action above the measured dock and out of the header', async () => {
    const { getByLabelText, getByText, getByTestId } = await render(
      <BottomChromeInsetProvider measuredHeight={89}><SyncIndicator /></BottomChromeInsetProvider>,
    );
    const banner = getByLabelText('Нет сети. Сохранённые материалы доступны.');
    const message = getByText('Нет сети. Сохранённые материалы доступны.');
    const action = getByLabelText('Открыть сохранённое');

    expect(banner.props.pointerEvents).toBe('box-none');
    const position = StyleSheet.flatten(banner.props.style);
    expect(position.bottom).toBe(89 + DESIGN_TOKENS.spacing.xs);
    expect(position.top).toBeUndefined();
    expect(getByTestId('sync-indicator-layer').props.pointerEvents).toBe('box-none');
    expect(StyleSheet.flatten(action.props.style).minHeight).toBe(44);
    expect(message.props.numberOfLines).toBe(2);
    expect(action).toBeTruthy();

    await fireEvent.press(action);
    expect(mockPush).toHaveBeenCalledWith('/offline');
  });

  it('keeps the saved-content action above the safe area when the route hides the dock', async () => {
    const { getByLabelText } = await render(
      <BottomChromeInsetProvider measuredHeight={0}><SyncIndicator /></BottomChromeInsetProvider>,
    );
    expect(StyleSheet.flatten(getByLabelText('Нет сети. Сохранённые материалы доступны.').props.style).bottom)
      .toBe(34 + DESIGN_TOKENS.spacing.xs);
  });

  it('does not add native offline chrome on web', async () => {
    const originalOS = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      expect(await (await render(<SyncIndicator />)).toJSON()).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });
});
