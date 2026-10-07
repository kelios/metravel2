import { act, renderHook } from '@testing-library/react-native';
import { FIT_REQUEST_EXPIRY_MS, useFitToResultsWhenSettled } from '@/hooks/map/useFitToResultsWhenSettled';

describe('deferred map fit command', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('fits the current result once when its query settles', () => {
    const oldFit = jest.fn(), currentFit = jest.fn();
    const { result, rerender } = renderHook(({ settled, fit }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false, fit: oldFit } });
    act(() => result.current());
    rerender({ settled: true, fit: currentFit });
    expect(oldFit).not.toHaveBeenCalled();
    expect(currentFit).toHaveBeenCalledTimes(1);
    rerender({ settled: true, fit: currentFit });
    act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS));
    expect(currentFit).toHaveBeenCalledTimes(1);
  });

  it('expires offline intent and does not move a later recovered map', () => {
    const fit = jest.fn();
    const { result, rerender } = renderHook(({ settled }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false } });
    act(() => result.current());
    act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS));
    rerender({ settled: true });
    expect(fit).not.toHaveBeenCalled();
  });

  it('a new user command replaces the previous deadline', () => {
    const fit = jest.fn();
    const { result, rerender } = renderHook(({ settled }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false } });
    act(() => result.current());
    act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS - 1));
    act(() => result.current());
    act(() => jest.advanceTimersByTime(2));
    rerender({ settled: true });
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it('disposes a pending command and its timer on unmount', () => {
    const fit = jest.fn();
    const { result, unmount } = renderHook(() => useFitToResultsWhenSettled(false, fit));
    act(() => result.current());
    unmount();
    act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS));
    expect(fit).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
