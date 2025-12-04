// __tests__/components/export/ThemePreview.test.tsx
// Тесты для компонента ThemePreview

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ThemePreview from '@/components/export/ThemePreview';
import type { PdfThemeName } from '@/components/export/ThemePreview';

describe('ThemePreview', () => {
  const mockOnThemeSelect = jest.fn();
  const defaultProps = {
    selectedTheme: 'minimal' as PdfThemeName,
    onThemeSelect: mockOnThemeSelect,
    compact: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);
      expect(getByText('Выберите тему оформления')).toBeTruthy();
    });

    it('should render all 8 themes', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      expect(getByText('Минимал')).toBeTruthy();
      expect(getByText('Светлая')).toBeTruthy();
      expect(getByText('Темная')).toBeTruthy();
      expect(getByText('Журнал')).toBeTruthy();
      expect(getByText('Классика')).toBeTruthy();
      expect(getByText('Модерн')).toBeTruthy();
      expect(getByText('Романтика')).toBeTruthy();
      expect(getByText('Приключение')).toBeTruthy();
    });

    it('should show theme descriptions', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      expect(getByText('Чистый и простой дизайн')).toBeTruthy();
      expect(getByText('Мягкие цвета и много воздуха')).toBeTruthy();
    });

    it('should display selected theme indicator', () => {
      const { getAllByText } = render(<ThemePreview {...defaultProps} />);

      const checkmarks = getAllByText('✓');
      expect(checkmarks.length).toBeGreaterThan(0);
    });
  });

  describe('theme selection', () => {
    it('should call onThemeSelect when theme is clicked', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      const darkTheme = getByText('Темная');
      fireEvent.press(darkTheme.parent!.parent!);

      expect(mockOnThemeSelect).toHaveBeenCalledWith('dark');
    });

    it('should highlight selected theme', () => {
      const { getByText } = render(
        <ThemePreview {...defaultProps} selectedTheme="dark" />
      );

      const darkTheme = getByText('Темная');
      const card = darkTheme.parent!.parent!;

      // Check if card has selected styling
      expect(card.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            borderColor: '#2563eb',
          }),
        ])
      );
    });

    it('should allow selecting different themes', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      const themes: PdfThemeName[] = ['light', 'dark', 'modern', 'romantic'];

      themes.forEach((theme) => {
        mockOnThemeSelect.mockClear();
        const themeElement = getByText(
          theme === 'light' ? 'Светлая' :
          theme === 'dark' ? 'Темная' :
          theme === 'modern' ? 'Модерн' :
          'Романтика'
        );
        fireEvent.press(themeElement.parent!.parent!);
        expect(mockOnThemeSelect).toHaveBeenCalledWith(theme);
      });
    });
  });

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      const { getByText } = render(
        <ThemePreview {...defaultProps} compact={true} />
      );

      expect(getByText('Выберите тему оформления')).toBeTruthy();
    });

    it('should show fewer details in compact mode', () => {
      const { queryByText } = render(
        <ThemePreview {...defaultProps} compact={true} />
      );

      // Font info should not be visible in compact mode
      const fontInfo = queryByText(/Inter • Inter/);
      expect(fontInfo).toBeFalsy();
    });
  });

  describe('theme information', () => {
    it('should display color palette for each theme', () => {
      const { getAllByTestId } = render(<ThemePreview {...defaultProps} />);

      // Each theme should have 3 color dots
      const colorDots = getAllByTestId(/color-dot/);
      expect(colorDots.length).toBeGreaterThan(0);
    });

    it('should display font information in normal mode', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      expect(getByText(/Inter • Inter/)).toBeTruthy();
      expect(getByText(/Montserrat • Open Sans/)).toBeTruthy();
    });

    it('should show theme preview thumbnail', () => {
      const { getAllByTestId } = render(<ThemePreview {...defaultProps} />);

      const thumbnails = getAllByTestId(/thumbnail/);
      expect(thumbnails.length).toBe(8);
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      expect(getByText('Выберите тему оформления')).toBeTruthy();
    });

    it('should be keyboard navigable', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      const theme = getByText('Минимал');
      const card = theme.parent!.parent!;

      expect(card.props.accessible).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined selectedTheme', () => {
      const { getByText } = render(
        <ThemePreview
          selectedTheme={undefined as any}
          onThemeSelect={mockOnThemeSelect}
        />
      );

      expect(getByText('Выберите тему оформления')).toBeTruthy();
    });

    it('should handle rapid theme changes', () => {
      const { getByText } = render(<ThemePreview {...defaultProps} />);

      const themes = ['Светлая', 'Темная', 'Модерн'];
      themes.forEach((themeName) => {
        const theme = getByText(themeName);
        fireEvent.press(theme.parent!.parent!);
      });

      expect(mockOnThemeSelect).toHaveBeenCalledTimes(3);
    });
  });
});
