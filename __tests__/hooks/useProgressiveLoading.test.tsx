/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading';

type ObserverInstance = {
  callback: IntersectionObserverCallback;
  observe: jest.Mock;
  disconnect: jest.Mock;
};

describe('useProgressiveLoad', () => {
  const originalOS = Platform.OS;
  const originalIntersectionObserver = global.IntersectionObserver;
  let observers: ObserverInstance[] = [];

  beforeEach(() => {
    Platform.OS = 'web';
    jest.useFakeTimers();
    observers = [];

    class MockIntersectionObserver {
      callback: IntersectionObserverCallback;
      observe = jest.fn();
      disconnect = jest.fn();

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.push(this as unknown as ObserverInstance);
      }
    }

    (global as any).IntersectionObserver = MockIntersectionObserver;
    (window as any).IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.useRealTimers();
    (global as any).IntersectionObserver = originalIntersectionObserver;
    (window as any).IntersectionObserver = originalIntersectionObserver;
  });

  it('does not auto-load below-the-fold content on web when fallback is disabled', () => {
    const { result } = renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 24000,
        disableFallbackOnWeb: true,
      }),
    );

    const node = document.createElement('div');
    act(() => {
      result.current.setElementRef(node as any);
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.shouldLoad).toBe(false);
    expect(observers.length).toBeGreaterThan(0);

    act(() => {
      observers[0].callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(result.current.shouldLoad).toBe(true);
  });
});
