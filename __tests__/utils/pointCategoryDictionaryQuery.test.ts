import {
  POINT_CATEGORY_DICTIONARY_REFRESH_EVENT,
  requestPointCategoryDictionaryRefresh,
} from '@/utils/pointCategoryDictionaryQuery';

jest.mock('@/api/miscOptimized', () => ({ fetchFiltersOptimized: jest.fn() }));

// Кейсы без window/document/Event (RN-алиас, SSR) живут в pointCategoryDictionaryQuery.node.test.ts:
// в jsdom 26 эти глобалы заменить нельзя (#2735).
describe('point category refresh DOM boundary', () => {
  it('emits the existing event to the browser subscriber', () => {
    const listener = jest.fn();
    window.addEventListener(POINT_CATEGORY_DICTIONARY_REFRESH_EVENT, listener);
    try {
      requestPointCategoryDictionaryRefresh();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toBeInstanceOf(Event);
      expect(listener.mock.calls[0][0].type).toBe(POINT_CATEGORY_DICTIONARY_REFRESH_EVENT);
    } finally {
      window.removeEventListener(POINT_CATEGORY_DICTIONARY_REFRESH_EVENT, listener);
    }
  });
});
