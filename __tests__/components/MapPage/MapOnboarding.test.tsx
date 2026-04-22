import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#6f9488',
    primaryLight: '#eef5f2',
    surface: '#ffffff',
    text: '#222222',
    textMuted: '#666666',
    border: '#d9d9d9',
    boxShadows: { heavy: '0 8px 24px rgba(0,0,0,0.14)' },
    shadows: { heavy: {} },
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name }: { name: string }) => React.createElement(Text, null, name);
});

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockButton({ label, onPress, testID }: { label: string; onPress?: () => void; testID?: string }) {
    return React.createElement(
      Pressable,
      { onPress, testID },
      React.createElement(Text, null, label),
    );
  };
});

import { MapOnboarding, restartMapOnboarding } from '@/components/MapPage/MapOnboarding';

describe('MapOnboarding', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does not auto-open on web', async () => {
    const { queryByText, queryByTestId } = render(<MapOnboarding />);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(queryByText('Карта путешествий')).toBeNull();
    expect(queryByTestId('onboarding-next')).toBeNull();
  });

  it('still opens when restarted manually', async () => {
    const { getByText, getByTestId } = render(<MapOnboarding />);

    await act(async () => {
      restartMapOnboarding();
    });

    expect(getByText('Карта путешествий')).toBeTruthy();
    expect(getByTestId('onboarding-next')).toBeTruthy();
  });
});
