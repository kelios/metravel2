/**
 * Тесты для проверки исправления фильтра по году
 * Проверяем, что год всегда передается как строка в API-запрос
 */

import { renderHook, act } from '@testing-library/react-native';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';
import { buildTravelQueryParams } from '@/utils/filterQuery';

describe('Year Filter Fix - API Request', () => {
  const defaultProps = {
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  };

  describe('Year should be string in queryParams', () => {
    it('should include year as string in queryParams', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.onSelect('year', '2022');
      });

      expect(result.current.filter.year).toBe('2022');
      expect(result.current.queryParams.year).toBe('2022');
      expect(typeof result.current.queryParams.year).toBe('string');
    });

    it('should preserve year during pagination', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({
          year: '2023',
          countries: [1],
        });
      });

      // Симулируем изменение других фильтров (как при пагинации)
      act(() => {
        result.current.onSelect('categories', ['hiking']);
      });

      // Год должен остаться
      expect(result.current.queryParams.year).toBe('2023');
      expect(result.current.queryParams.countries).toEqual([1]);
      expect(result.current.queryParams.categories).toBeUndefined();
    });

    it('should preserve year when other filters change', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2021' });
      });

      act(() => {
        result.current.onSelect('transports', [1, 2]);
      });

      expect(result.current.queryParams.year).toBe('2021');
      expect(result.current.queryParams.transports).toEqual([1, 2]);
    });
  });

  describe('Year in buildTravelQueryParams', () => {
    it('should include year in sanitized params', () => {
      const params = buildTravelQueryParams(
        { year: '2022', moderation: 1, publish: 1 },
        {}
      );

      expect(params.year).toBe('2022');
      expect(typeof params.year).toBe('string');
    });

    it('should not include year if empty', () => {
      const params = buildTravelQueryParams(
        { year: '', moderation: 1, publish: 1 },
        {}
      );

      expect(params.year).toBeUndefined();
    });

    it('should not include year if undefined', () => {
      const params = buildTravelQueryParams(
        { moderation: 1, publish: 1 },
        {}
      );

      expect(params.year).toBeUndefined();
    });

    it('should convert number year to string', () => {
      const params = buildTravelQueryParams(
        { year: 2022 as any, moderation: 1, publish: 1 },
        {}
      );

      expect(params.year).toBe('2022');
      expect(typeof params.year).toBe('string');
    });
  });

  describe('Year filter persistence', () => {
    it('should maintain year when resetting other filters', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({
          year: '2022',
          countries: [1],
          categories: ['hiking'],
        });
      });

      // Сбрасываем только категории
      act(() => {
        result.current.onSelect('categories', []);
      });

      expect(result.current.queryParams.year).toBe('2022');
      expect(result.current.queryParams.countries).toEqual([1]);
      expect(result.current.queryParams.categories).toBeUndefined();
    });

    it('should remove year when explicitly cleared', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2022' });
      });

      act(() => {
        result.current.onSelect('year', '');
      });

      expect(result.current.filter.year).toBeUndefined();
      expect(result.current.queryParams.year).toBeUndefined();
    });
  });

  describe('Year with default params', () => {
    it('should include year with moderation and publish', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({ year: '2022' });
      });

      const params = result.current.queryParams;
      expect(params.year).toBe('2022');
      expect(params.moderation).toBe(1);
      expect(params.publish).toBe(1);
    });

    it('should format final request correctly', () => {
      const { result } = renderHook(() => useListTravelFilters(defaultProps));

      act(() => {
        result.current.applyFilter({
          year: '2022',
          countries: [1, 2],
        });
      });

      const params = result.current.queryParams;
      
      // Проверяем формат запроса
      expect(params).toEqual(
        expect.objectContaining({
          year: '2022',
          countries: [1, 2],
          moderation: 1,
          publish: 1,
        })
      );
      
      // Год должен быть строкой
      expect(typeof params.year).toBe('string');
    });
  });
});
