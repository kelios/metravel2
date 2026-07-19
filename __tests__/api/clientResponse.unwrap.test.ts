import { unwrapList, unwrapPaginated } from '@/api/clientResponse';

describe('clientResponse envelope shell', () => {
  describe('unwrapList', () => {
    it('returns a bare array as-is', () => {
      expect(unwrapList([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('unwraps {results} (DRF)', () => {
      expect(unwrapList({ results: ['a', 'b'] })).toEqual(['a', 'b']);
    });

    it('unwraps {data}', () => {
      expect(unwrapList({ data: ['x'] })).toEqual(['x']);
    });

    it('unwraps {items}', () => {
      expect(unwrapList({ items: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    });

    it('prefers items over results over data when several are present', () => {
      expect(unwrapList({ items: ['i'], results: ['r'], data: ['d'] })).toEqual(['i']);
      expect(unwrapList({ results: ['r'], data: ['d'] })).toEqual(['r']);
    });

    it('returns [] for null / undefined / non-list objects / primitives', () => {
      expect(unwrapList(null)).toEqual([]);
      expect(unwrapList(undefined)).toEqual([]);
      expect(unwrapList({ detail: 'Invalid page.' })).toEqual([]);
      expect(unwrapList({ data: { results: ['nested'] } })).toEqual([]); // nested не разворачиваем здесь
      expect(unwrapList('oops')).toEqual([]);
      expect(unwrapList(42)).toEqual([]);
    });
  });

  describe('unwrapPaginated', () => {
    it('derives total from the array length for bare arrays', () => {
      expect(unwrapPaginated([1, 2])).toEqual({ items: [1, 2], total: 2 });
    });

    it('reads count (DRF) when total is absent', () => {
      expect(unwrapPaginated({ results: ['a'], count: 57 })).toEqual({ items: ['a'], total: 57 });
    });

    it('prefers total over count', () => {
      expect(unwrapPaginated({ results: ['a'], total: 9, count: 57 })).toEqual({ items: ['a'], total: 9 });
    });

    it('coerces a numeric string total', () => {
      expect(unwrapPaginated({ items: ['a', 'b'], total: '120' })).toEqual({ items: ['a', 'b'], total: 120 });
    });

    it('falls back to items length when total/count are missing or non-numeric', () => {
      expect(unwrapPaginated({ data: ['a', 'b', 'c'] })).toEqual({ items: ['a', 'b', 'c'], total: 3 });
      expect(unwrapPaginated({ results: ['a'], count: 'NaN-ish' })).toEqual({ items: ['a'], total: 1 });
    });

    it('returns empty for null / non-list payloads', () => {
      expect(unwrapPaginated(null)).toEqual({ items: [], total: 0 });
      expect(unwrapPaginated({ detail: 'Invalid page.' })).toEqual({ items: [], total: 0 });
    });
  });
});
