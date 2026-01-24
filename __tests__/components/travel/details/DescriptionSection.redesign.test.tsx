/**
 * DescriptionSection.redesign.test.tsx
 *
 * Тесты для редизайна секции описания путешествия
 */

import { render, fireEvent } from '@testing-library/react-native';
import { DescriptionSection } from '@/components/travel/details/redesign/DescriptionSection.redesign';
import { Icon } from '@/components/travel/details/TravelDetailsIcons';

// Мок для TravelDescription
jest.mock('@/components/travel/TravelDescription', () => {
  return jest.fn(({ htmlContent }) => {
    const { Text } = require('react-native');
    return <Text testID="travel-description">{htmlContent}</Text>;
  });
});

// Мок для хука темной темы
jest.mock('@/hooks/useTheme', () => {
  const { MODERN_MATTE_BOX_SHADOWS, MODERN_MATTE_SHADOWS } = require('@/constants/modernMattePalette');
  return {
    useThemedColors: jest.fn(() => ({
      surface: '#1a1a1a',
      surfaceElevated: '#2a2a2a',
      text: '#ffffff',
      textMuted: '#9ca3af',
      primary: '#3b82f6',
      borderLight: '#374151',
      backgroundSecondary: '#262626',
      shadows: MODERN_MATTE_SHADOWS,
      boxShadows: MODERN_MATTE_BOX_SHADOWS,
    })),
  };
});

describe('DescriptionSection.redesign', () => {
  const mockProps = {
    title: 'Тестовое путешествие',
    htmlContent: '<p>Описание путешествия</p>',
    numberDays: 5,
    countryName: 'Беларусь',
    monthName: 'Июнь',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг', () => {
    it('должен корректно отобразить базовую структуру', () => {
      const { getByTestId, getByText } = render(
        <DescriptionSection {...mockProps} />
      );

      expect(getByTestId('description-section-redesign')).toBeTruthy();
      expect(getByText('Описание маршрута')).toBeTruthy();
    });

    it('должен отобразить мета-информацию', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} />
      );

      expect(getByText(/5 дней/)).toBeTruthy();
      expect(getByText(/Беларусь/)).toBeTruthy();
      expect(getByText(/лучший сезон: июнь/)).toBeTruthy();
    });

    it('должен корректно форматировать количество дней (1 день)', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} numberDays={1} />
      );

      expect(getByText(/1 день/)).toBeTruthy();
    });

    it('должен корректно форматировать количество дней (2-4 дня)', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} numberDays={3} />
      );

      expect(getByText(/3 дня/)).toBeTruthy();
    });

    it('должен корректно форматировать количество дней (5+ дней)', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} numberDays={7} />
      );

      expect(getByText(/7 дней/)).toBeTruthy();
    });

    it('должен отобразить описание через TravelDescription', () => {
      const { getByTestId } = render(
        <DescriptionSection {...mockProps} />
      );

      expect(getByTestId('travel-description')).toBeTruthy();
    });

    it('должен работать без опциональных пропсов', () => {
      const { getByTestId, getByText } = render(
        <DescriptionSection
          title="Путешествие"
          htmlContent="<p>Описание</p>"
        />
      );

      expect(getByTestId('description-section-redesign')).toBeTruthy();
      expect(getByText('Описание маршрута')).toBeTruthy();
    });
  });

  describe('Советы (Decision Tips)', () => {
    it('должен отобразить советы первого уровня', () => {
      const tips = [
        { text: 'Совет 1', level: 0 },
        { text: 'Совет 2', level: 0 },
      ];

      const { getByText } = render(
        <DescriptionSection {...mockProps} decisionTips={tips} />
      );

      expect(getByText('Полезные советы перед поездкой')).toBeTruthy();
      expect(getByText('Совет 1')).toBeTruthy();
      expect(getByText('Совет 2')).toBeTruthy();
    });

    it('должен отобразить советы второго уровня', () => {
      const tips = [
        { text: 'Основной совет', level: 0 },
        { text: 'Подсовет 1', level: 1 },
        { text: 'Подсовет 2', level: 1 },
      ];

      const { getByText } = render(
        <DescriptionSection {...mockProps} decisionTips={tips} />
      );

      expect(getByText('Основной совет')).toBeTruthy();
      expect(getByText('Подсовет 1')).toBeTruthy();
      expect(getByText('Подсовет 2')).toBeTruthy();
    });

    it('не должен отображать блок советов, если список пуст', () => {
      const { queryByText } = render(
        <DescriptionSection {...mockProps} decisionTips={[]} />
      );

      expect(queryByText('Полезные советы перед поездкой')).toBeNull();
    });

    it('не должен отображать блок советов по умолчанию', () => {
      const { queryByText } = render(
        <DescriptionSection {...mockProps} />
      );

      expect(queryByText('Полезные советы перед поездкой')).toBeNull();
    });
  });

  describe('Кнопка "Назад к началу"', () => {
    it('должен отобразить кнопку на web с обработчиком', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const onBackToTop = jest.fn();
      const { getByText } = render(
        <DescriptionSection
          {...mockProps}
          onBackToTop={onBackToTop}
        />
      );

      const button = getByText('Назад к началу');
      expect(button).toBeTruthy();

      fireEvent.press(button);
      expect(onBackToTop).toHaveBeenCalledTimes(1);
    });

    it('не должен отображать кнопку на мобильных', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'ios';

      const onBackToTop = jest.fn();
      const { queryByText } = render(
        <DescriptionSection
          {...mockProps}
          onBackToTop={onBackToTop}
        />
      );

      expect(queryByText('Назад к началу')).toBeNull();
    });

    it('не должен отображать кнопку, если hideBackToTop=true', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const onBackToTop = jest.fn();
      const { queryByText } = render(
        <DescriptionSection
          {...mockProps}
          onBackToTop={onBackToTop}
          hideBackToTop
        />
      );

      expect(queryByText('Назад к началу')).toBeNull();
    });

    it('не должен отображать кнопку без обработчика', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const { queryByText } = render(
        <DescriptionSection {...mockProps} />
      );

      expect(queryByText('Назад к началу')).toBeNull();
    });
  });

  describe('Темная тема', () => {
    it('должен использовать темные цвета из useThemedColors', () => {
      const { useThemedColors } = require('@/hooks/useTheme');

      render(<DescriptionSection {...mockProps} />);

      expect(useThemedColors).toHaveBeenCalled();
    });

    it('должен применить темный фон к контейнеру', () => {
      const { getByTestId } = render(
        <DescriptionSection {...mockProps} />
      );

      const container = getByTestId('description-section-redesign');
      expect(container.props.style).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#1a1a1a' })
        ])
      );
    });
  });

  describe('Доступность (A11y)', () => {
    it('должен иметь корректную метку доступности', () => {
      const { getByTestId } = render(
        <DescriptionSection {...mockProps} />
      );

      const container = getByTestId('description-section-redesign');
      expect(container.props.accessible).toBe(true);
      expect(container.props.accessibilityLabel).toBe('Описание маршрута');
    });

    it('должен иметь header role', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} />
      );

      const header = getByText('Описание маршрута');
      expect(header.props.accessibilityRole).toBe('header');
    });

    it('должен скрыть декоративные иконки от screen readers', () => {
      const tips = [{ text: 'Совет', level: 0 }];
      const { UNSAFE_getAllByType } = render(
        <DescriptionSection {...mockProps} decisionTips={tips} />
      );

      const icons = UNSAFE_getAllByType(Icon);

      // Проверяем, что декоративные иконки имеют accessibilityElementsHidden
      const decorativeIcons = icons.filter(
        icon => icon.props.accessibilityElementsHidden
      );
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Компактный дизайн', () => {
    it('должен использовать уменьшенные размеры шрифтов', () => {
      const { getByText } = render(
        <DescriptionSection {...mockProps} />
      );

      const title = getByText('Описание маршрута');
      // Стили могут быть массивом или объектом
      const style = Array.isArray(title.props.style)
        ? title.props.style.find((s: any) => s && s.fontSize)
        : title.props.style;
      const fontSize = style?.fontSize;

      // Проверяем, что размер шрифта компактный (20-22px)
      expect(fontSize).toBeDefined();
      expect(fontSize).toBeLessThanOrEqual(22);
      expect(fontSize).toBeGreaterThanOrEqual(20);
    });

    it('должен использовать компактные отступы', () => {
      const { getByTestId } = render(
        <DescriptionSection {...mockProps} />
      );

      const container = getByTestId('description-section-redesign');
      const padding = container.props.style.find(
        (s: any) => s && typeof s.padding !== 'undefined'
      );

      expect(padding).toBeTruthy();
    });
  });

  describe('Адаптивность', () => {
    it('должен корректно работать на разных платформах', () => {
      const platforms = ['web', 'ios', 'android'];

      platforms.forEach(platform => {
        const Platform = require('react-native').Platform;
        Platform.OS = platform;

        const { getByTestId } = render(
          <DescriptionSection {...mockProps} />
        );

        expect(getByTestId('description-section-redesign')).toBeTruthy();
      });
    });
  });

  describe('Мемоизация', () => {
    it('должен быть обернут в memo для оптимизации', () => {
      // DescriptionSection должен быть мемоизирован
      expect(DescriptionSection.displayName).toBe('DescriptionSection');
    });
  });
});
