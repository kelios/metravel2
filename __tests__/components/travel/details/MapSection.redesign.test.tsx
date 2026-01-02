/**
 * MapSection.redesign.test.tsx
 *
 * Тесты для редизайна секции карты маршрута
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MapSection } from '@/components/travel/details/redesign/MapSection.redesign';

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

// Мок для useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    isPhone: false,
    isTablet: false,
    isDesktop: true,
    width: 1024,
    height: 768,
  })),
}));

describe('MapSection.redesign', () => {
  const MockMap = () => <Text testID="mock-map">Карта</Text>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг', () => {
    it('должен корректно отобразить базовую структуру', () => {
      const { getByTestId, getByText } = render(
        <MapSection>
          <MockMap />
        </MapSection>
      );

      expect(getByTestId('map-section-redesign')).toBeTruthy();
      expect(getByText('Карта маршрута')).toBeTruthy();
    });

    it('должен отобразить кнопку переключения', () => {
      const { getByTestId } = render(
        <MapSection>
          <MockMap />
        </MapSection>
      );

      expect(getByTestId('map-toggle-button')).toBeTruthy();
    });

    it('должен отобразить карту по умолчанию', () => {
      const { getByTestId } = render(
        <MapSection initiallyOpen={true}>
          <MockMap />
        </MapSection>
      );

      expect(getByTestId('mock-map')).toBeTruthy();
    });
  });

  describe('Переключение карты', () => {
    it('должен показать карту при клике на кнопку', () => {
      const { getByTestId, queryByTestId } = render(
        <MapSection initiallyOpen={false}>
          <MockMap />
        </MapSection>
      );

      expect(queryByTestId('mock-map')).toBeNull();

      fireEvent.press(getByTestId('map-toggle-button'));

      expect(getByTestId('mock-map')).toBeTruthy();
    });

    it('должен изменять текст кнопки при переключении', () => {
      const { getByTestId, getByText } = render(
        <MapSection initiallyOpen={true}>
          <MockMap />
        </MapSection>
      );

      expect(getByText('Скрыть карту')).toBeTruthy();

      fireEvent.press(getByTestId('map-toggle-button'));

      expect(getByText('Показать карту')).toBeTruthy();
    });
  });

  describe('Состояние загрузки', () => {
    it('должен отобразить индикатор загрузки', () => {
      const { getAllByText } = render(
        <MapSection isLoading={true} loadingLabel="Загружаем...">
          <MockMap />
        </MapSection>
      );

      const loadingTexts = getAllByText('Загружаем...');
      expect(loadingTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Пустое состояние', () => {
    it('должен отобразить пустое состояние без данных', () => {
      const { getByTestId, getByText } = render(
        <MapSection hasMapData={false}>
          <MockMap />
        </MapSection>
      );

      expect(getByTestId('map-empty-state')).toBeTruthy();
      expect(getByText('Маршрут ещё не добавлен')).toBeTruthy();
    });
  });

  describe('Темная тема', () => {
    it('должен использовать темные цвета', () => {
      const { useThemedColors } = require('@/hooks/useTheme');

      render(
        <MapSection>
          <MockMap />
        </MapSection>
      );

      expect(useThemedColors).toHaveBeenCalled();
    });
  });

  describe('Доступность', () => {
    it('должен иметь корректную метку', () => {
      const { getByTestId } = render(
        <MapSection>
          <MockMap />
        </MapSection>
      );

      const container = getByTestId('map-section-redesign');
      expect(container.props.accessible).toBe(true);
    });
  });

  describe('Мемоизация', () => {
    it('должен быть мемоизирован', () => {
      expect(MapSection.displayName).toBe('MapSection');
    });
  });
});
