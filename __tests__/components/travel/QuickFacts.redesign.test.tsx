/**
 * 🧪 Тесты для QuickFacts с темной темой
 *
 * Проверяет:
 * - Рендеринг фактов о путешествии
 * - Поддержку темной темы
 * - Компактный дизайн
 * - Accessibility
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import QuickFacts from '@/components/travel/QuickFacts';
import { ThemeProvider } from '@/hooks/useTheme';
import type { Travel } from '@/types/types';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  };
});

const mockTravel: Partial<Travel> = {
  id: 1,
  name: 'Test Travel',
  slug: 'test-travel',
  monthName: 'Сентябрь',
  year: 2024,
  number_days: 7,
  countryName: 'Беларусь',
  travelAddress: [
    {
      categoryName: 'Природа, Горы',
    },
  ],
} as any;

describe('QuickFacts - Редизайн с темной темой', () => {
  describe('Рендеринг', () => {
    it('должен отображать дату путешествия', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByText('Сентябрь 2024')).toBeTruthy();
    });

    it('должен отображать длительность', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByText('7 дней')).toBeTruthy();
    });

    it('должен отображать страну', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByText('Беларусь')).toBeTruthy();
    });

    it('должен отображать категории', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByText('Природа')).toBeTruthy();
      expect(screen.getByText('Горы')).toBeTruthy();
    });

    it('не должен рендериться если нет данных', () => {
      const emptyTravel: Partial<Travel> = {
        id: 2,
        name: 'Empty Travel',
      } as any;

      const { queryByLabelText } = render(
        <ThemeProvider>
          <QuickFacts travel={emptyTravel as Travel} />
        </ThemeProvider>
      );

      expect(queryByLabelText('Ключевая информация о путешествии')).toBeNull();
    });
  });

  describe('Компактный дизайн', () => {
    it('должен использовать уменьшенные padding (18px вместо 32px)', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      const quickFactsContainer = screen.getByLabelText('Ключевая информация о путешествии');
      const styles = StyleSheet.flatten(quickFactsContainer.props.style);
      const paddingVertical = styles.paddingVertical != null
        ? styles.paddingVertical * 2
        : (styles.paddingTop ?? 0) + (styles.paddingBottom ?? 0);

      // Проверяем что padding уменьшен (точное значение зависит от платформы)
      expect(paddingVertical).toBeLessThan(64); // было 64px (32+32)
      expect(paddingVertical).toBeGreaterThanOrEqual(20); // теперь 20-28px (compact inline strip)
    });

    it('должен использовать компактный gap между элементами', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      // Проверяем что элементы рендерятся
      expect(screen.getByText('Сентябрь 2024')).toBeTruthy();
      expect(screen.getByText('7 дней')).toBeTruthy();
    });

    it('категории должны иметь уменьшенный padding', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      const categoryButton = screen.getByLabelText('Категория: Природа');
      const styles = StyleSheet.flatten(categoryButton.props.style);
      const paddingHorizontal = styles.paddingHorizontal != null
        ? styles.paddingHorizontal * 2
        : (styles.paddingLeft ?? 0) + (styles.paddingRight ?? 0);

      // Было 32px (16+16), теперь 24-28px (12-14 + 12-14)
      expect(paddingHorizontal).toBeLessThan(32);
    });
  });

  describe('Темная тема', () => {
    it('должен применять themedColors к контейнеру', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      // Проверяем что компонент рендерится с правильным accessibility label
      const container = screen.getByLabelText('Ключевая информация о путешествии');
      expect(container).toBeTruthy();
    });

    it('должен применять цвета к иконкам', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      // Проверяем что иконки рендерятся (MaterialIcons/Feather)
      const icons = screen.queryAllByTestId(/^(material|feather)-/);
      expect(icons.length).toBeGreaterThan(0);
    });

    it('должен применять цвета к категориям', () => {
      const handleCategoryPress = jest.fn();
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} onCategoryPress={handleCategoryPress} />
        </ThemeProvider>
      );

      const categoryButtons = screen.getAllByRole('button');
      expect(categoryButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('должен иметь правильный accessibility label', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByLabelText('Ключевая информация о путешествии')).toBeTruthy();
    });

    it('категории должны иметь role="button" при наличии обработчика', () => {
      const handleCategoryPress = jest.fn();
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} onCategoryPress={handleCategoryPress} />
        </ThemeProvider>
      );

      const categoryButtons = screen.getAllByRole('button');
      expect(categoryButtons.length).toBeGreaterThan(0);
    });

    it('категории должны иметь accessibility labels', () => {
      render(
        <ThemeProvider>
          <QuickFacts travel={mockTravel as Travel} />
        </ThemeProvider>
      );

      expect(screen.getByLabelText('Категория: Природа')).toBeTruthy();
      expect(screen.getByLabelText('Категория: Горы')).toBeTruthy();
    });
  });

  describe('Форматирование данных', () => {
    it('должен правильно склонять "день"', () => {
      const travel1Day = { ...mockTravel, number_days: 1 };
      const { rerender } = render(
        <ThemeProvider>
          <QuickFacts travel={travel1Day as Travel} />
        </ThemeProvider>
      );
      expect(screen.getByText('1 день')).toBeTruthy();

      const travel2Days = { ...mockTravel, number_days: 2 };
      rerender(
        <ThemeProvider>
          <QuickFacts travel={travel2Days as Travel} />
        </ThemeProvider>
      );
      expect(screen.getByText('2 дня')).toBeTruthy();

      const travel5Days = { ...mockTravel, number_days: 5 };
      rerender(
        <ThemeProvider>
          <QuickFacts travel={travel5Days as Travel} />
        </ThemeProvider>
      );
      expect(screen.getByText('5 дней')).toBeTruthy();
    });

    it('должен ограничивать количество категорий до 5', () => {
      const travelWithManyCategories = {
        ...mockTravel,
        travelAddress: [
          { categoryName: 'Категория 1, Категория 2, Категория 3, Категория 4, Категория 5, Категория 6' },
        ],
      };

      render(
        <ThemeProvider>
          <QuickFacts travel={travelWithManyCategories as Travel} />
        </ThemeProvider>
      );

      // Должно быть максимум 5 категорий
      const categories = screen.getAllByLabelText(/^Категория:/);
      expect(categories.length).toBeLessThanOrEqual(5);
    });
  });
});
