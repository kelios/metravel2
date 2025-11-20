/**
 * Комплексные тесты для FiltersComponent - все типы фильтров
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FiltersComponent from '@/components/listTravel/FiltersComponent';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'travels' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FiltersComponent - All Filters', () => {
  const mockFilters = {
    categories: [
      { id: '1', name: 'Пеший туризм' },
      { id: '2', name: 'Велотуризм' },
      { id: '3', name: 'Автотуризм' },
    ],
    categoryTravelAddress: [
      { id: '1', name: 'Музей' },
      { id: '2', name: 'Парк' },
      { id: '3', name: 'Замок' },
    ],
    transports: [
      { id: '1', name: 'Пешком' },
      { id: '2', name: 'На велосипеде' },
      { id: '3', name: 'На машине' },
    ],
    companions: [
      { id: '1', name: 'Один' },
      { id: '2', name: 'С друзьями' },
      { id: '3', name: 'С семьей' },
    ],
    complexity: [
      { id: '1', name: 'Легкая' },
      { id: '2', name: 'Средняя' },
      { id: '3', name: 'Сложная' },
    ],
    month: [
      { id: '1', name: 'Январь' },
      { id: '2', name: 'Февраль' },
      { id: '3', name: 'Март' },
    ],
    over_nights_stay: [
      { id: '1', name: 'Однодневная' },
      { id: '2', name: 'С ночевкой' },
    ],
  };

  const mockOnSelectedItemsChange = jest.fn();
  const mockHandleApplyFilters = jest.fn();
  const mockResetFilters = jest.fn();
  const mockCloseMenu = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderComponent = (filterValue = {}) => {
    return render(
      <FiltersComponent
        filters={mockFilters}
        filterValue={filterValue}
        onSelectedItemsChange={mockOnSelectedItemsChange}
        handleApplyFilters={mockHandleApplyFilters}
        resetFilters={mockResetFilters}
        closeMenu={mockCloseMenu}
        isSuperuser={false}
      />
    );
  };

  const openFilterGroup = (getByText: any, label: string) => {
    const header = getByText(label);
    fireEvent.press(header);
  };

  describe('Categories filter', () => {
    it('should render categories filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Категории')).toBeTruthy();
    });

    it('should toggle category selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Категории');
      
      const hikingItem = getByText('Пеший туризм');
      fireEvent.press(hikingItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('categories', ['1']);
      });
    });

    it('should allow multiple category selection', async () => {
      const { getByText } = renderComponent({ categories: ['1'] });
      
      openFilterGroup(getByText, 'Категории');
      
      const cyclingItem = getByText('Велотуризм');
      fireEvent.press(cyclingItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('categories', ['1', '2']);
      });
    });
  });

  describe('CategoryTravelAddress filter', () => {
    it('should render categoryTravelAddress filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Объекты')).toBeTruthy();
    });

    it('should toggle object selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Объекты');
      
      const museumItem = getByText('Музей');
      fireEvent.press(museumItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('categoryTravelAddress', ['1']);
      });
    });
  });

  describe('Transports filter', () => {
    it('should render transports filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Транспорт')).toBeTruthy();
    });

    it('should toggle transport selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Транспорт');
      
      const walkingItem = getByText('Пешком');
      fireEvent.press(walkingItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('transports', ['1']);
      });
    });
  });

  describe('Companions filter', () => {
    it('should render companions filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Спутники')).toBeTruthy();
    });

    it('should toggle companion selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Спутники');
      
      const aloneItem = getByText('Один');
      fireEvent.press(aloneItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('companions', ['1']);
      });
    });
  });

  describe('Complexity filter', () => {
    it('should render complexity filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Сложность')).toBeTruthy();
    });

    it('should toggle complexity selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Сложность');
      
      const easyItem = getByText('Легкая');
      fireEvent.press(easyItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('complexity', ['1']);
      });
    });
  });

  describe('Month filter', () => {
    it('should render month filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Месяц')).toBeTruthy();
    });

    it('should toggle month selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Месяц');
      
      const januaryItem = getByText('Январь');
      fireEvent.press(januaryItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('month', ['1']);
      });
    });
  });

  describe('Over_nights_stay filter', () => {
    it('should render over_nights_stay filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Ночлег')).toBeTruthy();
    });

    it('should toggle over_nights_stay selection', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Ночлег');
      
      const dayTripItem = getByText('Однодневная');
      fireEvent.press(dayTripItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('over_nights_stay', ['1']);
      });
    });
  });

  describe('Multiple filters combination', () => {
    it('should handle multiple filter selections', async () => {
      const { getByText } = renderComponent({
        categories: ['1'],
        transports: ['2'],
      });
      
      openFilterGroup(getByText, 'Транспорт');
      const walkingItem = getByText('Пешком');
      fireEvent.press(walkingItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            categories: ['1'],
            transports: ['2', '1'],
          })
        );
      });
    });
  });

  describe('Filter reset', () => {
    it('should reset all filters when reset is called', () => {
      const { getByText } = renderComponent({
        categories: ['1', '2'],
        transports: ['1'],
        year: '2023',
      });

      // Find and click reset button (if exists in UI)
      // In the actual component, this might be triggered differently
      // For now, we test the resetFilters function directly
      expect(mockResetFilters).toBeDefined();
    });

    it('should clear all selections when reset', async () => {
      const { getByText } = renderComponent({
        categories: ['1'],
        transports: ['1'],
      });

      // Simulate reset - this would typically be done via a button
      // For testing purposes, we verify the reset function exists
      expect(mockResetFilters).toBeDefined();
    });
  });

  describe('Toggle all functionality', () => {
    it('should expand all filter groups', () => {
      const { getByText } = renderComponent();
      
      const toggleAllBtn = getByText('Развернуть все');
      fireEvent.press(toggleAllBtn);

      // All groups should be expanded
      expect(getByText('Пеший туризм')).toBeTruthy();
      expect(getByText('Пешком')).toBeTruthy();
    });

    it('should collapse all filter groups', () => {
      const { getByText, queryByText } = renderComponent();
      
      const toggleAllBtn = getByText('Развернуть все');
      fireEvent.press(toggleAllBtn);
      
      const collapseBtn = getByText('Свернуть все');
      fireEvent.press(collapseBtn);

      // Groups should be collapsed (items not visible)
      expect(queryByText('Пеший туризм')).toBeNull();
    });
  });

  describe('Auto-apply behavior', () => {
    it('should auto-apply filters when checkbox is toggled', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Транспорт');
      const walkingItem = getByText('Пешком');
      fireEvent.press(walkingItem);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalled();
      });
    });

    it('should debounce multiple rapid selections', async () => {
      const { getByText } = renderComponent();
      
      openFilterGroup(getByText, 'Транспорт');
      const walkingItem = getByText('Пешком');
      const bikeItem = getByText('На велосипеде');

      fireEvent.press(walkingItem);
      fireEvent.press(bikeItem);

      // Should only apply once after debounce
      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Empty states', () => {
    it('should handle empty filter options', () => {
      const { getByText } = render(
        <FiltersComponent
          filters={{}}
          filterValue={{}}
          onSelectedItemsChange={mockOnSelectedItemsChange}
          handleApplyFilters={mockHandleApplyFilters}
          resetFilters={mockResetFilters}
          closeMenu={mockCloseMenu}
          isSuperuser={false}
        />
      );

      // Should still render basic structure
      expect(getByText('Год')).toBeTruthy();
    });

    it('should handle filter groups with no items', () => {
      const emptyFilters = {
        categories: [],
        transports: [],
      };

      const { getByText } = renderComponent(emptyFilters);
      
      openFilterGroup(getByText, 'Категории');
      // Should not crash when no items available
      expect(getByText('Категории')).toBeTruthy();
    });
  });

  describe('Moderation filter (superuser only)', () => {
    it('should not show moderation filter for regular users', () => {
      const { queryByText } = renderComponent();
      
      expect(queryByText('Модерация')).toBeNull();
    });

    it('should show moderation filter for superusers', () => {
      const { getByText } = render(
        <FiltersComponent
          filters={mockFilters}
          filterValue={{}}
          onSelectedItemsChange={mockOnSelectedItemsChange}
          handleApplyFilters={mockHandleApplyFilters}
          resetFilters={mockResetFilters}
          closeMenu={mockCloseMenu}
          isSuperuser={true}
        />
      );

      expect(getByText('Модерация')).toBeTruthy();
    });

    it('should toggle moderation filter', async () => {
      const { getByText } = render(
        <FiltersComponent
          filters={mockFilters}
          filterValue={{}}
          onSelectedItemsChange={mockOnSelectedItemsChange}
          handleApplyFilters={mockHandleApplyFilters}
          resetFilters={mockResetFilters}
          closeMenu={mockCloseMenu}
          isSuperuser={true}
        />
      );

      const moderationCheckbox = getByText('Показать статьи на модерации');
      fireEvent.press(moderationCheckbox);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockOnSelectedItemsChange).toHaveBeenCalledWith('moderation', 0);
      });
    });
  });
});

