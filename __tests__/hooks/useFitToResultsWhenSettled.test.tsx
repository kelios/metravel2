import { act, renderHook } from '@testing-library/react-native';
import { FIT_REQUEST_EXPIRY_MS, useFitToResultsWhenSettled } from '@/hooks/map/useFitToResultsWhenSettled';

describe('deferred map fit command', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('fits the current result once when its query settles', async () => {
    const oldFit = jest.fn(), currentFit = jest.fn();
    const { result, rerender } = await renderHook(({ settled, fit }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false, fit: oldFit } });
    await act(() => result.current());
    await rerender({ settled: true, fit: currentFit });
    expect(oldFit).not.toHaveBeenCalled();
    expect(currentFit).toHaveBeenCalledTimes(1);
    await rerender({ settled: true, fit: currentFit });
    await act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS));
    expect(currentFit).toHaveBeenCalledTimes(1);
  });

  it('expires offline intent and does not move a later recovered map', async () => {
    const fit = jest.fn();
    const { result, rerender } = await renderHook(({ settled }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false } });
    await act(() => result.current());
    await act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS));
    await rerender({ settled: true });
    expect(fit).not.toHaveBeenCalled();
  });

  it('a new user command replaces the previous deadline', async () => {
    const fit = jest.fn();
    const { result, rerender } = await renderHook(({ settled }) => useFitToResultsWhenSettled(settled, fit), { initialProps: { settled: false } });
    await act(() => result.current());
    await act(() => jest.advanceTimersByTime(FIT_REQUEST_EXPIRY_MS - 1));
    await act(() => result.current());
    await act(() => jest.advanceTimersByTime(2));
    await rerender({ settled: true });
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it('disposes a pending command and its timer on unmount', async () => {
    const fit = jest.fn();
    const setTimer = jest.spyOn(globalThis, 'setTimeout');
    const clearTimer = jest.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = await renderHook(() => useFitToResultsWhenSettled(false, fit));
    await act(() => result.current());
    const expiryIndex = setTimer.mock.calls.findIndex(([, delay]) => delay === FIT_REQUEST_EXPIRY_MS);
    expect(expiryIndex).toBeGreaterThanOrEqual(0);
    const expiryTimer = setTimer.mock.results[expiryIndex].value;
    await unmount();
    expect(clearTimer).toHaveBeenCalledWith(expiryTimer);
    // No component remains mounted; advance the fake clock asynchronously so
    // React's completed act scheduling tasks are drained as well as the deadline.
    await jest.advanceTimersByTimeAsync(FIT_REQUEST_EXPIRY_MS);
    expect(fit).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    setTimer.mockRestore();
    clearTimer.mockRestore();
  });
});
