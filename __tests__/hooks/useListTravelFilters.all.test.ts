/**
 * Комплексные тесты для хука useListTravelFilters - все типы фильтров
 */

import { renderHook, act } from '@testing-library/react-native';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

describe('useListTravelFilters - All Filters', () => {
  const defaultProps = {
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
    options: {
      categories: [
        { id: '1', name: 'hiking' },
        { id: '2', name: 'cycling' },
        { id: '3', name: 'mountains' },
      ],
    },
  };

  describe('Countries filter', () => {
    it('should initialize with empty countries filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));
      expect(result.current.filter.countries).toBeUndefined();
    });

    it('should set countries filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1, 2, 3]);
      });

      expect(result.current.filter.countries).toEqual([1, 2, 3]);
      expect(result.current.queryParams.countries).toEqual([1, 2, 3]);
    });

    it('should remove countries when set to empty array', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1, 2]);
      });

      await act(() => {
        result.current.onSelect('countries', []);
      });

      expect(result.current.filter.countries).toBeUndefined();
      expect(result.current.queryParams.countries).toBeUndefined();
    });

    it('should normalize string IDs to numbers', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({ countries: ['1', '2', '3'] as any });
      });

      // Query params should have normalized numeric arrays
      expect(result.current.queryParams.countries).toEqual([1, 2, 3]);
    });
  });

  describe('Categories filter', () => {
    it('should initialize with empty categories filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));
      expect(result.current.filter.categories).toBeUndefined();
    });

    it('should set categories filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('categories', ['hiking', 'cycling']);
      });

      expect(result.current.filter.categories).toEqual([1, 2]);
      expect(result.current.queryParams.categories).toEqual([1, 2]);
    });

    it('should toggle category using handleToggleCategory', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.handleToggleCategory('hiking');
      });

      expect(result.current.filter.categories).toEqual([1]);

      await act(() => {
        result.current.handleToggleCategory('hiking');
      });

      expect(result.current.filter.categories).toBeUndefined();
    });

    it('should add multiple categories', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.handleToggleCategory('hiking');
      });

      await act(() => {
        result.current.handleToggleCategory('cycling');
      });

      expect(result.current.filter.categories).toContain(1);
      expect(result.current.filter.categories).toContain(2);
    });

    it('should merge numeric selections with mapped category names', async () => {
      const customProps = {
        ...defaultProps,
        options: {
          categories: [
            { id: '1', name: 'hiking' },
            { id: '2', name: 'cycling' },
            { id: '42', name: 'sailing' },
          ],
        },
      };
      const { result } = await renderHook(() => useListTravelFilters(customProps));

      await act(() => {
        result.current.onSelect('categories', [3]);
      });

      await act(() => {
        result.current.handleToggleCategory('sailing');
      });

      expect(result.current.filter.categories).toEqual([3, 42]);
      expect(result.current.queryParams.categories).toEqual([3, 42]);
    });

    it('should re-map stored category names when options become available', async () => {
      const initialProps = {
        ...defaultProps,
        options: undefined,
      };
      const { result, rerender } = await renderHook(
        (props: any) => useListTravelFilters(props),
        { initialProps }
      );

      await act(() => {
        result.current.handleToggleCategory('mountains');
      });

      expect(result.current.filter.categories).toEqual(['mountains']);
      expect(result.current.queryParams.categories).toBeUndefined();

      await rerender({
        ...initialProps,
        options: {
          categories: [{ id: '3', name: 'mountains' }],
        },
      });

      expect(result.current.queryParams.categories).toEqual([3]);
    });
  });

  describe('CategoryTravelAddress filter', () => {
    it('should set categoryTravelAddress filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('categoryTravelAddress', [1, 2]);
      });

      expect(result.current.filter.categoryTravelAddress).toEqual([1, 2]);
      expect(result.current.queryParams.categoryTravelAddress).toEqual([1, 2]);
    });

    it('should remove categoryTravelAddress when set to empty', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('categoryTravelAddress', [1]);
      });

      await act(() => {
        result.current.onSelect('categoryTravelAddress', []);
      });

      expect(result.current.filter.categoryTravelAddress).toBeUndefined();
    });
  });

  describe('Transports filter', () => {
    it('should set transports filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('transports', [1, 2, 3]);
      });

      expect(result.current.filter.transports).toEqual([1, 2, 3]);
      expect(result.current.queryParams.transports).toEqual([1, 2, 3]);
    });

    it('should handle single transport', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('transports', [1]);
      });

      expect(result.current.filter.transports).toEqual([1]);
    });
  });

  describe('Companions filter', () => {
    it('should set companions filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('companions', [1, 2]);
      });

      expect(result.current.filter.companions).toEqual([1, 2]);
      expect(result.current.queryParams.companions).toEqual([1, 2]);
    });
  });

  describe('Complexity filter', () => {
    it('should set complexity filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('complexity', [1, 2, 3]);
      });

      expect(result.current.filter.complexity).toEqual([1, 2, 3]);
      expect(result.current.queryParams.complexity).toEqual([1, 2, 3]);
    });
  });

  describe('Month filter', () => {
    it('should set month filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('month', [1, 2, 3]);
      });

      expect(result.current.filter.month).toEqual([1, 2, 3]);
      expect(result.current.queryParams.month).toEqual([1, 2, 3]);
    });
  });

  describe('Over_nights_stay filter', () => {
    it('should set over_nights_stay filter', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('over_nights_stay', [1, 2]);
      });

      expect(result.current.filter.over_nights_stay).toEqual([1, 2]);
      expect(result.current.queryParams.over_nights_stay).toEqual([1, 2]);
    });
  });

  describe('Multiple filters combination', () => {
    it('should combine multiple filters', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({
          countries: [1, 2],
          categories: ['hiking'],
          transports: [1],
          year: '2023',
        });
      });

      expect(result.current.filter.countries).toEqual([1, 2]);
      expect(result.current.filter.categories).toEqual([1]);
      expect(result.current.filter.transports).toEqual([1]);
      expect(result.current.filter.year).toBe('2023');

      expect(result.current.queryParams.countries).toEqual([1, 2]);
      expect(result.current.queryParams.categories).toEqual([1]);
      expect(result.current.queryParams.transports).toEqual([1]);
      expect(result.current.queryParams.year).toBe('2023');
    });

    it('should preserve existing filters when adding new ones', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      await act(() => {
        result.current.onSelect('categories', ['hiking']);
      });

      expect(result.current.filter.countries).toEqual([1]);
      expect(result.current.filter.categories).toEqual([1]);
    });

    it('should remove one filter without affecting others', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({
          countries: [1],
          categories: ['hiking'],
          transports: [1],
        });
      });

      await act(() => {
        result.current.onSelect('categories', []);
      });

      expect(result.current.filter.countries).toEqual([1]);
      expect(result.current.filter.categories).toBeUndefined();
      expect(result.current.filter.transports).toEqual([1]);
    });
  });

  describe('Filter reset', () => {
    it('should reset all filters', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({
          countries: [1, 2],
          categories: ['hiking'],
          transports: [1],
          companions: [1],
          complexity: [1],
          month: [1],
          over_nights_stay: [1],
          year: '2023',
        });
      });

      await act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filter.countries).toBeUndefined();
      expect(result.current.filter.categories).toBeUndefined();
      expect(result.current.filter.transports).toBeUndefined();
      expect(result.current.filter.companions).toBeUndefined();
      expect(result.current.filter.complexity).toBeUndefined();
      expect(result.current.filter.month).toBeUndefined();
      expect(result.current.filter.over_nights_stay).toBeUndefined();
      expect(result.current.filter.year).toBeUndefined();
    });
  });

  describe('Query params normalization', () => {
    it('should include default moderation and publish', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      expect(result.current.queryParams.moderation).toBe(1);
      expect(result.current.queryParams.publish).toBe(1);
    });

    it('should exclude empty arrays from queryParams', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      await act(() => {
        result.current.onSelect('categories', []);
      });

      expect(result.current.queryParams.countries).toEqual([1]);
      expect(result.current.queryParams.categories).toBeUndefined();
    });

    it('should normalize string array IDs to numbers', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({
          countries: ['1', '2'] as any,
          transports: ['3', '4'] as any,
        });
      });

      expect(result.current.queryParams.countries).toEqual([1, 2]);
      expect(result.current.queryParams.transports).toEqual([3, 4]);
    });

    it('should filter out invalid numeric values', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({
          countries: ['1', 'invalid', '2', NaN, Infinity] as any,
        });
      });

      expect(result.current.queryParams.countries).toEqual([1, 2]);
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      await act(() => {
        result.current.onSelect('countries', null as any);
      });

      expect(result.current.filter.countries).toBeUndefined();
    });

    it('should handle undefined values', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      await act(() => {
        result.current.onSelect('countries', undefined);
      });

      expect(result.current.filter.countries).toBeUndefined();
    });

    it('should handle empty string for year', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.onSelect('year', '2023');
      });

      await act(() => {
        result.current.onSelect('year', '');
      });

      expect(result.current.filter.year).toBeUndefined();
    });

    it('should handle whitespace-only year', async () => {
      const { result } = await renderHook(() => useListTravelFilters(defaultProps));

      await act(() => {
        result.current.applyFilter({ year: '   ' });
      });

      expect(result.current.filter.year).toBeUndefined();
      expect(result.current.queryParams.year).toBeUndefined();
    });
  });

  describe('Context-specific behavior', () => {
    it('should handle isMeTravel context', async () => {
      const { result } = await renderHook(() =>
        useListTravelFilters({ ...defaultProps, isMeTravel: true, userId: '123' })
      );

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      expect(result.current.queryParams.user_id).toBe('123');
      // /metravel includes drafts by default; explicit status toggles narrow the list.
      expect(result.current.queryParams.includeDrafts).toBe(true);
      expect(result.current.queryParams.moderation).toBeUndefined();
      expect(result.current.queryParams.publish).toBeUndefined();
    });

    it('should handle isTravelBy context', async () => {
      const { result } = await renderHook(() =>
        useListTravelFilters({ ...defaultProps, isTravelBy: true })
      );

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      // Belarus ID should be set (3)
      expect(result.current.queryParams.countries).toEqual([3]);
    });

    it('should handle routeUserId', async () => {
      const { result } = await renderHook(() =>
        useListTravelFilters({ ...defaultProps, user_id: '456' })
      );

      await act(() => {
        result.current.onSelect('countries', [1]);
      });

      expect(result.current.queryParams.user_id).toBe('456');
    });
  });
});
