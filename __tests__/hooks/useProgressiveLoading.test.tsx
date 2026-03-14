/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react-native';
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

  it('loads immediately when enabled — no delays, no intersection observer', () => {
    const { result } = renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 24000,
        enabled: true,
      }),
    );

    // shouldLoad is true immediately — no waiting for intersection or timer
    expect(result.current.shouldLoad).toBe(true);
  });

  it('does not load when disabled', () => {
    const { result } = renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        enabled: false,
      }),
    );

    expect(result.current.shouldLoad).toBe(false);
  });
});
