// __tests__/components/export/PresetSelector.test.tsx
// Тесты для компонента PresetSelector

import { render, fireEvent } from '@testing-library/react-native';
import PresetSelector from '@/components/export/PresetSelector';
import { BOOK_PRESETS } from '@/types/pdf-presets';

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
    it('should render without crashing', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);
      expect(getByText('Быстрый старт')).toBeTruthy();
    });

    it('should show subtitle', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);
      expect(getByText('Выберите готовый пресет или настройте вручную')).toBeTruthy();
    });

    it('should render all presets', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      BOOK_PRESETS.forEach((preset) => {
        expect(getByText(preset.name)).toBeTruthy();
      });
    });

    it('should show preset descriptions', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getByText(/Только текст и ключевые фото/)).toBeTruthy();
      expect(getByText(/Акцент на фотографии/)).toBeTruthy();
    });

    it('should display preset icons', async () => {
      const { queryAllByText } = await render(<PresetSelector {...defaultProps} />);

      // Icons are rendered via Feather mock as text nodes (e.g. "camera", "map").
      // Assert presence without relying on mock-specific testIDs.
      const possibleIconLabels = ['file-text', 'image', 'map', 'camera', 'book-open', 'printer'];
      const found = possibleIconLabels.some((label) => queryAllByText(label).length > 0);
      expect(found).toBeTruthy();
    });
  });

  describe('categories', () => {
    it('should show category filters when enabled', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getByText('Все')).toBeTruthy();
      expect(getByText('Минимализм')).toBeTruthy();
      expect(getByText('Детальные')).toBeTruthy();
      expect(getByText('Фото')).toBeTruthy();
    });

    it('should hide category filters when disabled', async () => {
      const { queryByText } = await render(
        <PresetSelector {...defaultProps} showCategories={false} />
      );

      expect(queryByText('Все')).toBeFalsy();
      expect(queryByText('Минимализм')).toBeFalsy();
    });

    it('should filter presets by category', async () => {
      const { getByText, queryByText } = await render(<PresetSelector {...defaultProps} />);

      // Click on "Фото" category
      const photoCategory = getByText('Фото');
      await fireEvent.press(photoCategory);

      // Should show photo-focused presets
      expect(getByText('Фотоальбом')).toBeTruthy();
      expect(getByText('Романтическое путешествие')).toBeTruthy();

      // Should not show other categories
      expect(queryByText('Путеводитель')).toBeFalsy();
    });

    it('should show all presets when "Все" is selected', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      const allCategory = getByText('Все');
      await fireEvent.press(allCategory);

      BOOK_PRESETS.forEach((preset) => {
        expect(getByText(preset.name)).toBeTruthy();
      });
    });
  });

  describe('preset selection', () => {
    it('should call onPresetSelect when preset is clicked', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      const preset = getByText('Фотоальбом');
      await fireEvent.press(preset.parent!.parent!);

      expect(mockOnPresetSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo-album',
          name: 'Фотоальбом',
        })
      );
    });

    it('should show checkmark on selected preset', async () => {
      const { getAllByText } = await render(
        <PresetSelector {...defaultProps} selectedPresetId="photo-album" />
      );

      // Selected badge is rendered as a pill with text "Выбрано"
      const selectedBadges = getAllByText('Выбрано');
      expect(selectedBadges).toHaveLength(1);
    });

    it('should move the selected badge when selectedPresetId changes', async () => {
      const { getAllByText, rerender } = await render(
        <PresetSelector {...defaultProps} selectedPresetId="photo-album" />
      );

      expect(getAllByText('Выбрано')).toHaveLength(1);

      await rerender(<PresetSelector {...defaultProps} selectedPresetId="travel-guide" />);

      expect(getAllByText('Выбрано')).toHaveLength(1);
    });
  });

  describe('preset features', () => {
    it('should display feature badges', async () => {
      const { getAllByText } = await render(<PresetSelector {...defaultProps} />);

      // Travel guide should have all features - use getAllByText since features may appear multiple times
      expect(getAllByText('Галерея').length).toBeGreaterThan(0);
      expect(getAllByText('Карты').length).toBeGreaterThan(0);
      expect(getAllByText('Чек-листы').length).toBeGreaterThan(0);
    });

    it('should show default badge for default preset', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getByText('По умолчанию')).toBeTruthy();
    });

    it('keeps feature badges aligned with preset settings', async () => {
      const { getByText, getAllByText, queryByText } = await render(<PresetSelector {...defaultProps} />);

      await fireEvent.press(getByText('Минимализм'));

      expect(getByText('Минималист')).toBeTruthy();
      expect(getByText('Современный минимализм')).toBeTruthy();
      expect(getAllByText('Галерея')).toHaveLength(1);
      expect(queryByText('Чек-листы')).toBeFalsy();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getByText('Быстрый старт')).toBeTruthy();
      expect(getByText('Выберите готовый пресет или настройте вручную')).toBeTruthy();
    });

    it('keeps the preset action label visible for every rendered preset', async () => {
      const { getAllByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getAllByText('Выбрать')).toHaveLength(BOOK_PRESETS.length);
    });
  });

  describe('edge cases', () => {
    it('should handle no selected preset', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      expect(getByText('Быстрый старт')).toBeTruthy();
      // Should not crash
    });

    it('should handle invalid selected preset ID', async () => {
      const { getByText } = await render(
        <PresetSelector {...defaultProps} selectedPresetId="invalid-id" />
      );

      expect(getByText('Быстрый старт')).toBeTruthy();
      // Should not crash
    });

    it('should handle rapid preset changes', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      const presets = ['Минималист', 'Фотоальбом', 'Путеводитель'];
      for (const presetName of presets) {
        const preset = getByText(presetName);
        await fireEvent.press(preset.parent!.parent!);
      }

      expect(mockOnPresetSelect).toHaveBeenCalledTimes(3);
    });

    it('should handle empty category filter', async () => {
      const { getByText } = await render(<PresetSelector {...defaultProps} />);

      // Click on a category
      const category = getByText('Печать');
      await fireEvent.press(category);

      // Should show at least one preset
      expect(getByText('Для печати')).toBeTruthy();
    });
  });
});
