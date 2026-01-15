import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useScrollNavigation } from '@/hooks/useScrollNavigation';

describe('useScrollNavigation (web)', () => {
  beforeEach(() => {
    Platform.OS = 'web' as any;

    // Basic DOM setup
    document.body.innerHTML = `
      <div id="scroll-container" style="height: 200px; overflow-y: auto;">
        <div style="height: 1000px; position: relative;">
          <div data-section-key="description" id="target"></div>
        </div>
      </div>
    `;

    // JSDOM doesn't compute layout; we stub rects.
    const container = document.getElementById('scroll-container') as any;
    const target = document.getElementById('target') as any;

    // In JSDOM these layout props are often read-only; define explicitly.
    Object.defineProperty(container, 'scrollTop', { value: 10, writable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 200, writable: true });

    container.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 200, width: 200, height: 200 } as any);
    target.getBoundingClientRect = () => ({ top: 120, bottom: 160, left: 0, right: 200, width: 200, height: 40 } as any);

    // Simulate DOM scroll APIs by mutating scrollTop. This prevents the hook from
    // assuming scrollTo was a no-op and falling back to numeric signatures.
    container.scrollTo = jest.fn((arg1: any, arg2?: any) => {
      if (typeof arg1 === 'object' && arg1) {
        container.scrollTop = Number(arg1.top ?? 0);
        return;
      }
      container.scrollTop = Number(arg2 ?? 0);
    });
    container.scrollBy = jest.fn((arg1: any, arg2?: any) => {
      if (typeof arg1 === 'object' && arg1) {
        container.scrollTop = Number(container.scrollTop ?? 0) + Number(arg1.top ?? 0);
        return;
      }
      container.scrollTop = Number(container.scrollTop ?? 0) + Number(arg2 ?? 0);
    });

    // Make getComputedStyle reflect a scrollable container
    jest.spyOn(window, 'getComputedStyle').mockImplementation((el: any) => {
      if (el && el.id === 'scroll-container') {
        return { overflowY: 'auto' } as any;
      }
      return { overflowY: 'visible' } as any;
    });

    // Avoid async timers in these tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('scrolls the nearest scrollable container when available', () => {
    const { result } = renderHook(() => useScrollNavigation());

    // Patch scrollRef.current so hook can locate the scroll container.
    // In app this is a RN ScrollView instance; for test we mimic getScrollableNode.
    (result.current.scrollRef as any).current = {
      getScrollableNode: () => document.getElementById('scroll-container'),
    };

    act(() => {
      result.current.scrollTo('description');
    });

    const container: any = document.getElementById('scroll-container');
    expect(container.scrollTo).toHaveBeenCalledTimes(1);

    // Regression guard: should not scroll the window when a container exists
    expect((window as any).scrollTo).not.toHaveBeenCalled();
    expect((window as any).scrollBy).not.toHaveBeenCalled();

    // targetTop = currentTop(10) + (elTop(120) - containerTop(0))
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 130, behavior: 'smooth' });
  });

  it('applies header offset via container.scrollBy (not window) when container supports it', () => {
    const { result } = renderHook(() => useScrollNavigation());
    (result.current.scrollRef as any).current = {
      getScrollableNode: () => document.getElementById('scroll-container'),
    };

    act(() => {
      result.current.scrollTo('description');
      jest.runAllTimers();
    });

    const container: any = document.getElementById('scroll-container');
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
    expect(container.scrollBy).toHaveBeenCalledTimes(1);

    // safeOffset = min(headerOffset, targetTop). We don't assert exact headerOffset here,
    // only that it is applied negatively to the container (never to window).
    expect(container.scrollBy.mock.calls[0][0]).toMatchObject({ top: expect.any(Number), left: 0 });
    expect(container.scrollBy.mock.calls[0][0].top).toBeLessThanOrEqual(0);
    expect((window as any).scrollBy).not.toHaveBeenCalled();
  });

  it('falls back to scrollTop assignment when scrollTo throws', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const container: any = document.getElementById('scroll-container');

    container.scrollTo = jest
      .fn()
      .mockImplementation((arg1: any, _arg2?: any) => {
        if (typeof arg1 === 'object') {
          throw new Error('Options object signature not supported');
        }
        throw new Error('Numeric signature not supported');
      });

    (result.current.scrollRef as any).current = {
      getScrollableNode: () => container,
    };

    act(() => {
      result.current.scrollTo('description');
    });

    expect(container.scrollTo).toHaveBeenCalled();
    expect(container.scrollTop).toBe(130);

    // Regression guard: should not scroll the window
    expect((window as any).scrollTo).not.toHaveBeenCalled();
  });

  it('falls back to scrollIntoView when no scrollable container is detected', () => {
    const { result } = renderHook(() => useScrollNavigation());
    (result.current.scrollRef as any).current = null;

    const target = document.getElementById('target') as any;
    target.scrollIntoView = jest.fn();

    // Make container appear non-scrollable
    const container: any = document.getElementById('scroll-container');
    Object.defineProperty(container, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(container, 'clientHeight', { value: 200, writable: true });

    act(() => {
      result.current.scrollTo('description');
      jest.runAllTimers();
    });

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  });
});
