import { renderHook, act } from '@testing-library/react-native';
import { useScrollNavigation } from '@/hooks/useScrollNavigation';

const NATIVE_STICKY_SECTION_OFFSET = 156;

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    ScrollView: actual.ScrollView,
    View: actual.View,
  };
});

describe('useScrollNavigation', () => {
  it('creates anchors for predefined section keys', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const keys = Object.keys(result.current.anchors);
    expect(keys).toContain('gallery');
    expect(keys).toContain('map');
    expect(keys).toContain('popular');
  });

  it('scrollTo uses measureLayout and scrollTo when anchor exists', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const fakeScrollRef = {
      current: {
        scrollTo: jest.fn(),
      },
    } as any;

    // Подменяем scrollRef
    (result.current as any).scrollRef.current = fakeScrollRef.current;

    const anchor = {
      current: {
        measureLayout: jest.fn((relativeTo, onSuccess) => {
          onSuccess(0, 120);
        }),
      },
    } as any;

    (result.current as any).anchors['map'] = anchor;

    act(() => {
      result.current.scrollTo('map');
    });

    expect(fakeScrollRef.current.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('measureLayout uses native scroll ref, not a node-handle number (Android-bug 95)', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const nativeScrollRef = { __nativeScrollRef: true };
    const getNativeScrollRef = jest.fn(() => nativeScrollRef);
    ;(result.current as any).scrollRef.current = {
      scrollTo: jest.fn(),
      getNativeScrollRef,
    };

    const measureLayout = jest.fn((_relativeTo, onSuccess) => onSuccess(0, 200));
    ;(result.current as any).anchors['description'] = { current: { measureLayout } };

    act(() => {
      result.current.scrollTo('description');
    });

    expect(getNativeScrollRef).toHaveBeenCalled();
    const relativeArg = measureLayout.mock.calls[0][0];
    // Fabric требует ref на нативный компонент, а не числовой node handle
    expect(relativeArg).toBe(nativeScrollRef);
    expect(typeof relativeArg).not.toBe('number');
  });

  it('retries native scroll when a lazy section mounts after the first tap', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useScrollNavigation());

    const nativeScrollRef = { __nativeScrollRef: true };
    const scrollTo = jest.fn();
    ;(result.current as any).scrollRef.current = {
      scrollTo,
      getNativeScrollRef: () => nativeScrollRef,
    };
    ;(result.current as any).anchors['map'] = { current: null };

    act(() => {
      result.current.scrollTo('map');
    });

    expect(scrollTo).not.toHaveBeenCalled();

    const measureLayout = jest.fn((_relativeTo, onSuccess) => onSuccess(0, 240));
    ;(result.current as any).anchors['map'] = { current: { measureLayout } };

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(measureLayout).toHaveBeenCalledWith(
      nativeScrollRef,
      expect.any(Function),
      expect.any(Function),
    );
    expect(scrollTo).toHaveBeenCalledWith({ y: 84, animated: true });
    jest.useRealTimers();
  });

  it('keeps retrying when native measureLayout fails before a section can be measured', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useScrollNavigation());

    const nativeScrollRef = { __nativeScrollRef: true };
    const scrollTo = jest.fn();
    ;(result.current as any).scrollRef.current = {
      scrollTo,
      getNativeScrollRef: () => nativeScrollRef,
    };

    const measureLayout = jest
      .fn()
      .mockImplementationOnce((_relativeTo, _onSuccess, onFail) => onFail())
      .mockImplementationOnce((_relativeTo, onSuccess) => onSuccess(0, 360));
    ;(result.current as any).anchors['description'] = { current: { measureLayout } };

    act(() => {
      result.current.scrollTo('description');
    });

    expect(measureLayout).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(measureLayout).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledWith({ y: 204, animated: true });
    jest.useRealTimers();
  });

  it.each(['description', 'map', 'points'] as const)(
    'recovers sticky quick jump navigation to %s after a transient native measure failure',
    (sectionKey) => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useScrollNavigation());

      const nativeScrollRef = { __nativeScrollRef: true };
      const scrollTo = jest.fn();
      ;(result.current as any).scrollRef.current = {
        scrollTo,
        getNativeScrollRef: () => nativeScrollRef,
      };

      const targetY = sectionKey === 'description' ? 180 : sectionKey === 'map' ? 720 : 960;
      const measureLayout = jest
        .fn()
        .mockImplementationOnce((_relativeTo, _onSuccess, onFail) => onFail())
        .mockImplementationOnce((_relativeTo, onSuccess) => onSuccess(0, targetY));
      ;(result.current as any).anchors[sectionKey] = { current: { measureLayout } };

      act(() => {
        result.current.scrollTo(sectionKey);
      });

      expect(scrollTo).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(120);
      });

      expect(scrollTo).toHaveBeenCalledWith({
        y: Math.max(0, targetY - NATIVE_STICKY_SECTION_OFFSET),
        animated: true,
      });
      jest.useRealTimers();
    },
  );

  it('keeps native quick-jump targets below the sticky section navigation', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const scrollTo = jest.fn();
    ;(result.current as any).scrollRef.current = {
      scrollTo,
      getNativeScrollRef: () => ({ __nativeScrollRef: true }),
    };
    ;(result.current as any).anchors.points = {
      current: {
        measureLayout: jest.fn((_relativeTo, onSuccess) => onSuccess(0, 960)),
      },
    };

    act(() => {
      result.current.scrollTo('points');
    });

    expect(scrollTo).toHaveBeenCalledWith({ y: 804, animated: true });
  });

  it('does nothing when anchor or scrollRef is missing', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useScrollNavigation());

    // Не устанавливаем scrollRef и anchor явно
    act(() => {
      result.current.scrollTo('non-existing');
      jest.runOnlyPendingTimers();
    });

    // Отсутствие ошибок уже достаточно; поведение "ничего не делать"
    expect(true).toBe(true);
    jest.useRealTimers();
  });
});
