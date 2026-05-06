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

  it('waits for visibility or fallback on web when enabled', () => {
    const { result } = renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 800,
        enabled: true,
      }),
    );

    expect(result.current.shouldLoad).toBe(false);

    act(() => {
      result.current.setElementRef(document.createElement('div'));
    });

    expect(observers).toHaveLength(1);
    expect(observers[0]?.observe).toHaveBeenCalledTimes(1);

    act(() => {
      observers[0]?.callback([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(result.current.shouldLoad).toBe(true);
  });

  it('loads after fallback delay when element never becomes visible', () => {
    const { result } = renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 800,
        enabled: true,
      }),
    );

    act(() => {
      result.current.setElementRef(document.createElement('div'));
    });

    expect(result.current.shouldLoad).toBe(false);

    act(() => {
      jest.advanceTimersByTime(800);
    });

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
