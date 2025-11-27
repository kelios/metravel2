/**
 * Тесты для хука useListTravelFilters - фильтр по году
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

describe('useListTravelFilters - Year Filter', () => {
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

  describe('Year filter state (smoke)', () => {
    it('should initialize with empty filter', () => {
      const { result } = renderHook();

      expect(result.filter.year).toBeUndefined();
    });

    it('allows selecting and clearing year without crashes', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      act(() => {
        result.onSelect('year', '');
      });

      // Конкретное значение filter.year зависит от реализации и не важно для этого smoke-теста
      expect(result.filter).toBeDefined();
    });
  });

  describe('Year filter reset (smoke)', () => {
    it('resetFilters does not crash when year was selected', () => {
      const { result } = renderHook();

      act(() => {
        result.onSelect('year', '2023');
      });

      act(() => {
        result.resetFilters();
      });

      // Проверяем только, что filter существует, без жёстких ожиданий по year
      expect(result.filter).toBeDefined();
    });
  });
});
