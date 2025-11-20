/**
 * Тесты для хука useListTravelFilters - фильтр по году
 */

import { renderHook, act } from '@testing-library/react';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

describe('useListTravelFilters - Year Filter', () => {
  const defaultProps = {
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  };

  describe('Year filter state', () => {
    it('should initialize with empty filter', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      expect(result.current.filter.year).toBeUndefined();
    });

    it('should set year filter', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2023');
      });

      expect(result.current.filter.year).toBe('2023');
    });

    it('should include year in queryParams', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2021');
      });

      expect(result.current.queryParams.year).toBe('2021');
    });

    it('should remove year when set to empty string', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2023');
      });

      expect(result.current.filter.year).toBe('2023');

      act(() => {
        result.current.onSelect('year', '');
      });

      expect(result.current.filter.year).toBeUndefined();
      expect(result.current.queryParams.year).toBeUndefined();
    });

    it('should remove year when set to undefined', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2023');
      });

      act(() => {
        result.current.onSelect('year', undefined);
      });

      expect(result.current.filter.year).toBeUndefined();
    });
  });

  describe('Year filter with applyFilter', () => {
    it('should apply year filter using applyFilter', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2022' });
      });

      expect(result.current.filter.year).toBe('2022');
      expect(result.current.queryParams.year).toBe('2022');
    });

    it('should clear year when applyFilter with empty string', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2022' });
      });

      act(() => {
        result.current.applyFilter({ year: '' });
      });

      expect(result.current.filter.year).toBeUndefined();
    });

    it('should combine year with other filters', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({
          year: '2021',
          countries: [1, 2],
          categories: ['hiking'],
        });
      });

      expect(result.current.filter.year).toBe('2021');
      expect(result.current.filter.countries).toEqual([1, 2]);
      expect(result.current.filter.categories).toEqual(['hiking']);
      
      expect(result.current.queryParams.year).toBe('2021');
      expect(result.current.queryParams.countries).toEqual([1, 2]);
    });
  });

  describe('Year filter reset', () => {
    it('should reset year filter when resetFilters is called', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2023');
      });

      expect(result.current.filter.year).toBe('2023');

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filter.year).toBeUndefined();
      expect(result.current.queryParams.year).toBeUndefined();
    });

    it('should reset all filters including year', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({
          year: '2022',
          countries: [1],
          categories: ['hiking'],
        });
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filter.year).toBeUndefined();
      expect(result.current.filter.countries).toBeUndefined();
      expect(result.current.filter.categories).toBeUndefined();
    });
  });

  describe('Year filter queryParams normalization', () => {
    it('should include year in queryParams with default moderation/publish', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2023');
      });

      const params = result.current.queryParams;
      expect(params.year).toBe('2023');
      expect(params.moderation).toBe(1);
      expect(params.publish).toBe(1);
    });

    it('should preserve year when other filters change', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2021' });
      });

      act(() => {
        result.current.onSelect('countries', [1]);
      });

      expect(result.current.queryParams.year).toBe('2021');
      expect(result.current.queryParams.countries).toEqual([1]);
    });
  });
});

