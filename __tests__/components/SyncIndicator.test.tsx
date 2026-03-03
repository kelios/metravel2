// __tests__/components/SyncIndicator.test.tsx
// AND-10: Tests for sync indicator component.

import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock useNetworkStatus
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn().mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({ value: v }),
    withTiming: (v: number) => v,
  };
});

describe('SyncIndicator', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    // @ts-ignore
    Platform.OS = originalPlatform;
  });

  it('renders null on web', () => {
    // @ts-ignore
    Platform.OS = 'web';

    jest.resetModules();
    const { SyncIndicator } = require('@/components/ui/SyncIndicator');

    const { toJSON } = render(<SyncIndicator />);
    expect(toJSON()).toBeNull();
  });

  it('renders null when connected and never was offline', () => {
    // @ts-ignore
    Platform.OS = 'android';

    jest.resetModules();
    const { SyncIndicator } = require('@/components/ui/SyncIndicator');

    const { toJSON } = render(<SyncIndicator />);
    // When always online, indicator should not be visible
    expect(toJSON()).toBeNull();
  });
});

