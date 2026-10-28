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

  it('waits for visibility or fallback on web when enabled', async () => {
    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 800,
        enabled: true,
      }),
    );

    expect(result.current.shouldLoad).toBe(false);

    await act(() => {
      result.current.setElementRef(document.createElement('div'));
    });

    expect(observers).toHaveLength(1);
    expect(observers[0]?.observe).toHaveBeenCalledTimes(1);

    await act(() => {
      observers[0]?.callback([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(result.current.shouldLoad).toBe(true);
  });

  it('loads after fallback delay when element never becomes visible', async () => {
    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0.05,
        rootMargin: '200px',
        fallbackDelay: 800,
        enabled: true,
      }),
    );

    await act(() => {
      result.current.setElementRef(document.createElement('div'));
    });

    expect(result.current.shouldLoad).toBe(false);

    await act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(result.current.shouldLoad).toBe(true);
  });

  it('does not load when disabled', async () => {
    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        enabled: false,
      }),
    );

    expect(result.current.shouldLoad).toBe(false);
  });

  // #2010: блок финала квеста грузит каталог только по видимости — таймер не
  // должен подменять прокрутку, сколько бы страница ни была открыта.
  it('keeps visibility-only content unloaded by time and loads it on intersection', async () => {
    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        threshold: 0,
        enabled: true,
        disableFallbackOnWeb: true,
      }),
    );

    await act(() => {
      result.current.setElementRef(document.createElement('div'));
    });
    expect(observers).toHaveLength(1);

    await act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.shouldLoad).toBe(false);

    await act(() => {
      observers[0]?.callback([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });
    expect(result.current.shouldLoad).toBe(true);
  });

  it('loads visibility-only content when IntersectionObserver is unavailable', async () => {
    delete (window as any).IntersectionObserver;
    delete (global as any).IntersectionObserver;

    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        enabled: true,
        disableFallbackOnWeb: true,
      }),
    );

    expect(result.current.shouldLoad).toBe(true);
  });

  it('keeps deferred sections eager on Android', async () => {
    Platform.OS = 'android';

    const { result } = await renderHook(() =>
      useProgressiveLoad({
        priority: 'low',
        enabled: true,
        disableFallbackOnWeb: true,
      }),
    );

    expect(result.current.shouldLoad).toBe(true);
    expect(observers).toHaveLength(0);
  });
});
