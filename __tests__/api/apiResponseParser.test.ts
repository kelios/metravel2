/**
 * K2: Tests for API error normalization utilities
 * @module __tests__/api/apiResponseParser.test.ts
 */

import {
  asRecord,
  parsePaginatedResponse,
  coerceNumber,
  coerceString,
  coerceBoolean,
  getErrorStatus,
  isAbortError,
} from '@/api/parsers/apiResponseParser';

describe('apiResponseParser', () => {
  describe('asRecord', () => {
    it('returns Record for plain objects', () => {
      expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    });
    it('returns empty Record for null', () => {
      expect(asRecord(null)).toEqual({});
    });
    it('returns empty Record for undefined', () => {
      expect(asRecord(undefined)).toEqual({});
    });
    it('returns empty Record for arrays', () => {
      expect(asRecord([1, 2])).toEqual({});
    });
    it('returns empty Record for primitives', () => {
      expect(asRecord('hello')).toEqual({});
      expect(asRecord(42)).toEqual({});
    });
  });

  describe('coerceNumber', () => {
    it('returns number for valid number', () => {
      expect(coerceNumber(42)).toBe(42);
    });
    it('parses numeric string', () => {
      expect(coerceNumber('123')).toBe(123);
    });
    it('returns fallback for NaN', () => {
      expect(coerceNumber('abc', 0)).toBe(0);
    });
    it('returns 0 for null (Number(null) === 0)', () => {
      expect(coerceNumber(null, -1)).toBe(0);
    });
    it('returns fallback for Infinity', () => {
      expect(coerceNumber(Infinity, 0)).toBe(0);
    });
    it('returns 0 as default fallback', () => {
      expect(coerceNumber(undefined)).toBe(0);
    });
  });

  describe('coerceString', () => {
    it('returns string as-is', () => {
      expect(coerceString('hello')).toBe('hello');
    });
    it('returns fallback for null', () => {
      expect(coerceString(null, 'default')).toBe('default');
    });
    it('returns fallback for undefined', () => {
      expect(coerceString(undefined)).toBe('');
    });
    it('converts numbers to string', () => {
      expect(coerceString(42)).toBe('42');
    });
  });

  describe('coerceBoolean', () => {
    it('returns true for true', () => {
      expect(coerceBoolean(true)).toBe(true);
    });
    it('returns false for false', () => {
      expect(coerceBoolean(false)).toBe(false);
    });
    it('returns true for 1', () => {
      expect(coerceBoolean(1)).toBe(true);
    });
    it('returns true for "1"', () => {
      expect(coerceBoolean('1')).toBe(true);
    });
    it('returns true for "true"', () => {
      expect(coerceBoolean('true')).toBe(true);
    });
    it('returns false for 0', () => {
      expect(coerceBoolean(0)).toBe(false);
    });
    it('returns false for null', () => {
      expect(coerceBoolean(null)).toBe(false);
    });
  });

  describe('parsePaginatedResponse', () => {
    const identity = (x: unknown) => x;

    it('handles null payload', () => {
      expect(parsePaginatedResponse(null, identity)).toEqual({ items: [], total: 0 });
    });

    it('handles array payload', () => {
      const result = parsePaginatedResponse([1, 2, 3], identity);
      expect(result.items).toEqual([1, 2, 3]);
      expect(result.total).toBe(3);
    });

    it('handles { results: [] } payload', () => {
      const result = parsePaginatedResponse({ results: ['a', 'b'], count: 10 }, identity);
      expect(result.items).toEqual(['a', 'b']);
      expect(result.total).toBe(10);
    });

    it('handles { data: [] } payload', () => {
      const result = parsePaginatedResponse({ data: [1], total: 5 }, identity);
      expect(result.items).toEqual([1]);
      expect(result.total).toBe(5);
    });

    it('handles { items: [] } payload', () => {
      const result = parsePaginatedResponse({ items: [1, 2] }, identity);
      expect(result.items).toEqual([1, 2]);
      expect(result.total).toBe(2);
    });

    it('handles empty object', () => {
      const result = parsePaginatedResponse({}, identity);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies normalizeItem to each item', () => {
      const double = (x: unknown) => (x as number) * 2;
      const result = parsePaginatedResponse([1, 2, 3], double);
      expect(result.items).toEqual([2, 4, 6]);
    });
  });

  describe('getErrorStatus', () => {
    it('returns status from plain object', () => {
      expect(getErrorStatus({ status: 404 })).toBe(404);
    });
    it('returns status from nested response', () => {
      expect(getErrorStatus({ response: { status: 500 } })).toBe(500);
    });
    it('returns null for non-objects', () => {
      expect(getErrorStatus('error')).toBeNull();
      expect(getErrorStatus(null)).toBeNull();
      expect(getErrorStatus(undefined)).toBeNull();
    });
    it('returns null for missing status', () => {
      expect(getErrorStatus({ message: 'fail' })).toBeNull();
    });
    it('returns null for non-finite status', () => {
      expect(getErrorStatus({ status: 'abc' })).toBeNull();
    });
  });

  describe('isAbortError', () => {
    it('returns true for AbortError', () => {
      const err = new DOMException('Aborted', 'AbortError');
      expect(isAbortError(err)).toBe(true);
    });
    it('returns true for object with name AbortError', () => {
      expect(isAbortError({ name: 'AbortError' })).toBe(true);
    });
    it('returns false for other errors', () => {
      expect(isAbortError(new Error('fail'))).toBe(false);
    });
    it('returns false for non-objects', () => {
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError('AbortError')).toBe(false);
    });
  });
});

