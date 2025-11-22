/**
 * Тесты для хука useListTravelFilters - фильтр по году
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

describe.skip('useListTravelFilters - Year Filter', () => {
  const defaultProps = {
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  };

  type HookResult = ReturnType<typeof useListTravelFilters>;

  const renderHook = () => {
    let result: HookResult | undefined;

    const TestComponent = () => {
      result = useListTravelFilters(defaultProps);
      return null;
    };

    TestRenderer.create(React.createElement(TestComponent));

    return { result: result as HookResult };
  };

  describe('Year filter state', () => {
    it('should initialize with empty filter', () => {
      const { result } = renderHook();

      expect(result.filter.year).toBeUndefined();
    });

    it('should set year filter', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      expect(result.filter.year).toBe('2023');
    });

    it('should include year in queryParams', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2021');
      });

      expect(result.queryParams.year).toBe('2021');
    });

    it('should remove year when set to empty string', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      expect(result.filter.year).toBe('2023');

      act(() => {
        result.onSelect('year', '');
      });

      expect(result.filter.year).toBeUndefined();
      expect(result.queryParams.year).toBeUndefined();
    });

    it('should remove year when set to undefined', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      act(() => {
        result.onSelect('year', undefined);
      });

      expect(result.filter.year).toBeUndefined();
    });
  });

  describe('Year filter with applyFilter', () => {
    it('should apply year filter using applyFilter', () => {
      const { result } = renderHook();

      act(() => {
        result.applyFilter({ year: '2022' });
      });

      expect(result.filter.year).toBe('2022');
      expect(result.queryParams.year).toBe('2022');
    });

    it('should clear year when applyFilter with empty string', () => {
      const { result } = renderHook();

      act(() => {
        result.applyFilter({ year: '2022' });
      });

      act(() => {
        result.applyFilter({ year: '' });
      });

      expect(result.filter.year).toBeUndefined();
    });

    it('should combine year with other filters', () => {
      const { result } = renderHook();

      act(() => {
        result.applyFilter({
          year: '2021',
          countries: [1, 2],
          categories: ['hiking'],
        });
      });

      expect(result.filter.year).toBe('2021');
      expect(result.filter.countries).toEqual([1, 2]);
      expect(result.filter.categories).toEqual(['hiking']);
      
      expect(result.queryParams.year).toBe('2021');
      expect(result.queryParams.countries).toEqual([1, 2]);
    });
  });

  describe('Year filter reset', () => {
    it('should reset year filter when resetFilters is called', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      expect(result.filter.year).toBe('2023');

      act(() => {
        result.resetFilters();
      });

      expect(result.filter.year).toBeUndefined();
      expect(result.queryParams.year).toBeUndefined();
    });

    it('should reset all filters including year', () => {
      const { result } = renderHook();

      act(() => {
        result.applyFilter({
          year: '2022',
          countries: [1],
          categories: ['hiking'],
        });
      });

      act(() => {
        result.resetFilters();
      });

      expect(result.filter.year).toBeUndefined();
      expect(result.filter.countries).toBeUndefined();
      expect(result.filter.categories).toBeUndefined();
    });
  });

  describe('Year filter queryParams normalization', () => {
    it('should include year in queryParams with default moderation/publish', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      const params = result.queryParams;
      expect(params.year).toBe('2023');
      expect(params.moderation).toBe(1);
      expect(params.publish).toBe(1);
    });

    it('should preserve year when other filters change', () => {
      const { result } = renderHook();

      act(() => {
        result.applyFilter({ year: '2021' });
      });

      act(() => {
        result.onSelect('countries', [1]);
      });

      expect(result.queryParams.year).toBe('2021');
      expect(result.queryParams.countries).toEqual([1]);
    });
  });
});

