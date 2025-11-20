/**
 * Тесты для фильтра по году в FiltersComponent
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

describe('FiltersComponent - Year Filter', () => {
  const mockFilters = {
    countries: [],
    categories: [],
    transports: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
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

  describe('Year input', () => {
    it('should render year filter section', () => {
      const { getByText } = renderComponent();
      expect(getByText('Год')).toBeTruthy();
    });

    it('should open year input when clicked', () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      const yearHeader = getByText('Год');
      fireEvent.press(yearHeader);

      expect(getByPlaceholderText('2023')).toBeTruthy();
    });

    it('should accept only numeric input', () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '2023abc');
      
      // Должен остаться только '2023'
      expect(input.props.value).toBe('2023');
    });

    it('should limit input to 4 characters', () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '20234');
      
      // Должен быть обрезан до 4 символов
      expect(input.props.value).toBe('2023');
    });

    it('should auto-apply filter when 4 digits entered', async () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '2021');
      
      // Ждем debounce (400ms)
      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            year: '2021',
          })
        );
      });
    });

    it('should show clear button when year is entered', () => {
      const { getByText, getByPlaceholderText, getByLabelText } = renderComponent({ year: '2021' });
      
      fireEvent.press(getByText('Год'));
      
      const clearButton = getByLabelText('Очистить год');
      expect(clearButton).toBeTruthy();
    });

    it('should clear year when clear button is pressed', () => {
      const { getByText, getByPlaceholderText, getByLabelText } = renderComponent({ year: '2021' });
      
      fireEvent.press(getByText('Год'));
      const clearButton = getByLabelText('Очистить год');
      
      fireEvent.press(clearButton);

      const input = getByPlaceholderText('2023');
      expect(input.props.value).toBe('');
    });

    it('should apply filter when year is cleared', async () => {
      const { getByText, getByPlaceholderText, getByLabelText } = renderComponent({ year: '2021' });
      
      fireEvent.press(getByText('Год'));
      const clearButton = getByLabelText('Очистить год');
      
      fireEvent.press(clearButton);

      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalled();
      });
    });
  });

  describe('Year filter integration', () => {
    it('should include year in filter value when applied', async () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '2022');
      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            year: '2022',
          })
        );
      });
    });

    it('should reset year when reset filters is called', () => {
      const { getByText } = renderComponent({ year: '2021' });
      
      // Находим кнопку сброса (если она есть)
      // В реальном компоненте это может быть кнопка "Сбросить"
      const resetButton = getByText('Сбросить');
      if (resetButton) {
        fireEvent.press(resetButton);
        expect(mockResetFilters).toHaveBeenCalled();
      }
    });

    it('should combine year with other filters', async () => {
      const { getByText, getByPlaceholderText } = renderComponent({
        categories: ['1'],
        year: '2020',
      });
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '2023');
      jest.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockHandleApplyFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            year: '2023',
            categories: ['1'],
          })
        );
      });
    });
  });

  describe('Year filter edge cases', () => {
    it('should handle partial year input (1-3 digits)', () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '20');
      expect(input.props.value).toBe('20');
      
      // Не должен применяться автоматически
      jest.advanceTimersByTime(400);
      expect(mockHandleApplyFilters).not.toHaveBeenCalled();
    });

    it('should handle empty year input', () => {
      const { getByText, getByPlaceholderText } = renderComponent({ year: '2021' });
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '');
      expect(input.props.value).toBe('');
    });

    it('should handle year with leading zeros', () => {
      const { getByText, getByPlaceholderText } = renderComponent();
      
      fireEvent.press(getByText('Год'));
      const input = getByPlaceholderText('2023');

      fireEvent.changeText(input, '0202');
      expect(input.props.value).toBe('0202');
    });
  });
});

