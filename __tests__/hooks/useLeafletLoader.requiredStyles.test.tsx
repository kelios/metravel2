jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { OS: 'web', select: (obj: any) => obj.web ?? obj.default },
  };
});

import { act, renderHook } from '@testing-library/react-native';

import { useLeafletLoader } from '@/hooks/useLeafletLoader';

describe('useLeafletLoader required styles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    jest.useFakeTimers();

    Object.defineProperty(window, 'requestIdleCallback', {
      value: jest.fn(() => 1),
      writable: true,
    });

    Object.defineProperty(window, 'cancelIdleCallback', {
      value: jest.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('injects required Leaflet fallback styles on web mount (test env)', async () => {
    renderHook(() => useLeafletLoader({ enabled: true, useIdleCallback: true }));

    await act(async () => {
      // Flush effects
    });

    const fallback = document.querySelector('style[data-leaflet-fallback="true"]');
    expect(fallback).toBeTruthy();
  });

  it('injects fallback styles if Leaflet CSS does not load within timeout', async () => {
    renderHook(() => useLeafletLoader({ enabled: true, useIdleCallback: true }));

    await act(async () => {
      // Ensure initial effect ran and scheduled the timeout
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      jest.runOnlyPendingTimers();
    });

    const fallback = document.querySelector('style[data-leaflet-fallback="true"]');
    expect(fallback).toBeTruthy();
  });
});
