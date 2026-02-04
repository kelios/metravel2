import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useLeafletLoader } from '@/hooks/useLeafletLoader';

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const ORIGINAL_PLATFORM_OS = Platform.OS;

describe('useLeafletLoader required styles', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
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
    Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS, configurable: true });
  });

  it('injects Leaflet CSS link or fallback styles on web mount', async () => {
    renderHook(() => useLeafletLoader({ enabled: true, useIdleCallback: true }));

    await act(async () => {
      // Flush effects
    });

    const link = document.querySelector(`link[rel="stylesheet"][href="${LEAFLET_CSS_HREF}"]`);
    const fallback = document.querySelector('style[data-leaflet-fallback="true"]');
    expect(!!link || !!fallback).toBe(true);
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
