import { act, renderHook } from '@testing-library/react-native';

import { POINTS_SEARCH_DEBOUNCE_MS, usePointsSearch } from '@/components/UserPoints/usePointsSearch';

// #3132: поле ввода мгновенное, модель получает запрос после паузы, пустое поле — сразу.
describe('usePointsSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies the query only after the typing pause', async () => {
    const { result } = await renderHook(() => usePointsSearch());

    await act(async () => {
      result.current.setSearchQuery('к');
    });
    await act(async () => {
      result.current.setSearchQuery('ко');
    });
    await act(async () => {
      result.current.setSearchQuery('кос');
    });
    expect(result.current.searchQuery).toBe('кос');
    expect(result.current.appliedSearchQuery).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(POINTS_SEARCH_DEBOUNCE_MS - 1);
    });
    expect(result.current.appliedSearchQuery).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.appliedSearchQuery).toBe('кос');
  });

  it('clears the applied query immediately when the field is emptied', async () => {
    const { result } = await renderHook(() => usePointsSearch());

    await act(async () => {
      result.current.setSearchQuery('озеро');
    });
    await act(async () => {
      jest.advanceTimersByTime(POINTS_SEARCH_DEBOUNCE_MS);
    });
    expect(result.current.appliedSearchQuery).toBe('озеро');

    await act(async () => {
      result.current.setSearchQuery('');
    });
    expect(result.current.appliedSearchQuery).toBe('');
  });
});
