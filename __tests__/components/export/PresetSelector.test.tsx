// __tests__/components/export/PresetSelector.test.tsx
// Тесты для компонента PresetSelector

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PresetSelector from '@/components/export/PresetSelector';
import { BOOK_PRESETS } from '@/src/types/pdf-presets';
import type { BookPreset } from '@/src/types/pdf-presets';

describe('PresetSelector', () => {
  const mockOnPresetSelect = jest.fn();
  const defaultProps = {
    onPresetSelect: mockOnPresetSelect,
    selectedPresetId: undefined,
    showCategories: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);
      expect(getByText('Быстрый старт')).toBeTruthy();
    });

    it('should show subtitle', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);
      expect(getByText('Выберите готовый пресет или настройте вручную')).toBeTruthy();
    });

    it('should render all presets', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      BOOK_PRESETS.forEach((preset) => {
        expect(getByText(preset.name)).toBeTruthy();
      });
    });

    it('should show preset descriptions', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText(/Только текст и ключевые фото/)).toBeTruthy();
      expect(getByText(/Акцент на фотографии/)).toBeTruthy();
    });

    it('should display preset icons', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('📝')).toBeTruthy();
      expect(getByText('📸')).toBeTruthy();
      expect(getByText('🗺️')).toBeTruthy();
    });
  });

  describe('categories', () => {
    it('should show category filters when enabled', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('Все')).toBeTruthy();
      expect(getByText('Минимализм')).toBeTruthy();
      expect(getByText('Детальные')).toBeTruthy();
      expect(getByText('Фото')).toBeTruthy();
    });

    it('should hide category filters when disabled', () => {
      const { queryByText } = render(
        <PresetSelector {...defaultProps} showCategories={false} />
      );

      expect(queryByText('Все')).toBeFalsy();
      expect(queryByText('Минимализм')).toBeFalsy();
    });

    it('should filter presets by category', () => {
      const { getByText, queryByText } = render(<PresetSelector {...defaultProps} />);

      // Click on "Фото" category
      const photoCategory = getByText('Фото');
      fireEvent.press(photoCategory);

      // Should show photo-focused presets
      expect(getByText('Фотоальбом')).toBeTruthy();
      expect(getByText('Романтическое путешествие')).toBeTruthy();

      // Should not show other categories
      expect(queryByText('Путеводитель')).toBeFalsy();
    });

    it('should show all presets when "Все" is selected', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      const allCategory = getByText('Все');
      fireEvent.press(allCategory);

      BOOK_PRESETS.forEach((preset) => {
        expect(getByText(preset.name)).toBeTruthy();
      });
    });

    it('should highlight selected category', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      const category = getByText('Фото');
      fireEvent.press(category);

      // Check if category has selected styling
      expect(category.parent!.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: '#2563eb',
          }),
        ])
      );
    });
  });

  describe('preset selection', () => {
    it('should call onPresetSelect when preset is clicked', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      const preset = getByText('Фотоальбом');
      fireEvent.press(preset.parent!.parent!);

      expect(mockOnPresetSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo-album',
          name: 'Фотоальбом',
        })
      );
    });

    it('should highlight selected preset', () => {
      const { getByText } = render(
        <PresetSelector {...defaultProps} selectedPresetId="photo-album" />
      );

      const preset = getByText('Фотоальбом');
      const card = preset.parent!.parent!;

      expect(card.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            borderColor: '#2563eb',
          }),
        ])
      );
    });

    it('should show checkmark on selected preset', () => {
      const { getAllByText } = render(
        <PresetSelector {...defaultProps} selectedPresetId="photo-album" />
      );

      const checkmarks = getAllByText('✓');
      expect(checkmarks.length).toBeGreaterThan(0);
    });
  });

  describe('preset features', () => {
    it('should display feature badges', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      // Travel guide should have all features
      expect(getByText('Галерея')).toBeTruthy();
      expect(getByText('Карты')).toBeTruthy();
      expect(getByText('Чек-листы')).toBeTruthy();
    });

    it('should show default badge for default preset', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('По умолчанию')).toBeTruthy();
    });

    it('should show custom badge for custom presets', () => {
      const customPreset: BookPreset = {
        id: 'custom-1',
        name: 'Мой пресет',
        description: 'Пользовательский пресет',
        category: 'detailed',
        icon: '⭐',
        isCustom: true,
        settings: {
          title: 'Test',
          template: 'minimal',
          sortOrder: 'date-desc',
          includeToc: true,
          includeGallery: true,
          includeMap: false,
          includeChecklists: false,
          checklistSections: [],
          coverType: 'auto',
        },
      };

      // Mock BOOK_PRESETS to include custom preset
      jest.mock('@/src/types/pdf-presets', () => ({
        BOOK_PRESETS: [...BOOK_PRESETS, customPreset],
      }));

      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('Мой')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('Быстрый старт')).toBeTruthy();
      expect(getByText('Выберите готовый пресет или настройте вручную')).toBeTruthy();
    });

    it('should be keyboard navigable', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      const preset = getByText('Минималист');
      const card = preset.parent!.parent!;

      expect(card.props.accessible).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle no selected preset', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      expect(getByText('Быстрый старт')).toBeTruthy();
      // Should not crash
    });

    it('should handle invalid selected preset ID', () => {
      const { getByText } = render(
        <PresetSelector {...defaultProps} selectedPresetId="invalid-id" />
      );

      expect(getByText('Быстрый старт')).toBeTruthy();
      // Should not crash
    });

    it('should handle rapid preset changes', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      const presets = ['Минималист', 'Фотоальбом', 'Путеводитель'];
      presets.forEach((presetName) => {
        const preset = getByText(presetName);
        fireEvent.press(preset.parent!.parent!);
      });

      expect(mockOnPresetSelect).toHaveBeenCalledTimes(3);
    });

    it('should handle empty category filter', () => {
      const { getByText } = render(<PresetSelector {...defaultProps} />);

      // Click on a category
      const category = getByText('Печать');
      fireEvent.press(category);

      // Should show at least one preset
      expect(getByText('Для печати')).toBeTruthy();
    });
  });
});
