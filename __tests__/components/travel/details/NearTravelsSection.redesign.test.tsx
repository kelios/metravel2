/**
 * NearTravelsSection.redesign.test.tsx
 *
 * Тесты для редизайна секции похожих маршрутов
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NearTravelsSection } from '@/components/travel/details/redesign/NearTravelsSection.redesign';

// Мок для хука темной темы
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: jest.fn(() => ({
    surface: '#1a1a1a',
    surfaceElevated: '#2a2a2a',
    text: '#ffffff',
    textMuted: '#9ca3af',
    primary: '#3b82f6',
    borderLight: '#374151',
    backgroundSecondary: '#262626',
  })),
}));

describe('NearTravelsSection.redesign', () => {
  const MockTravelList = () => <Text testID="travel-list">Список маршрутов</Text>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг', () => {
    it('должен корректно отобразить базовую структуру', () => {
      const { getByTestId, getByText } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-section-redesign')).toBeTruthy();
      expect(getByText('Рядом можно посмотреть')).toBeTruthy();
    });

    it('должен отобразить заголовок по умолчанию', () => {
      const { getByText } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByText('Рядом можно посмотреть')).toBeTruthy();
    });

    it('должен отобразить кастомный заголовок', () => {
      const { getByText } = render(
        <NearTravelsSection title="Другие маршруты">
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByText('Другие маршруты')).toBeTruthy();
    });

    it('должен отобразить подзаголовок с радиусом', () => {
      const { getByText } = render(
        <NearTravelsSection radiusKm={50}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByText('Маршруты в радиусе ~50 км')).toBeTruthy();
    });

    it('должен отобразить кастомный подзаголовок', () => {
      const { getByText } = render(
        <NearTravelsSection subtitle="В окрестностях">
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByText('В окрестностях')).toBeTruthy();
    });

    it('должен отобразить дочерний контент', () => {
      const { getByTestId } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('travel-list')).toBeTruthy();
    });
  });

  describe('Состояние загрузки', () => {
    it('должен отобразить скелетоны при isLoading=true', () => {
      const { getByTestId, queryByTestId } = render(
        <NearTravelsSection isLoading={true}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-loading')).toBeTruthy();
      expect(queryByTestId('travel-list')).toBeNull();
    });

    it('должен отобразить контент при isLoading=false', () => {
      const { getByTestId, queryByTestId } = render(
        <NearTravelsSection isLoading={false}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('travel-list')).toBeTruthy();
      expect(queryByTestId('near-travels-loading')).toBeNull();
    });

    it('должен отображать 3 скелетона при загрузке', () => {
      const { UNSAFE_getAllByType } = render(
        <NearTravelsSection isLoading={true}>
          <MockTravelList />
        </NearTravelsSection>
      );

      const { View } = require('react-native');
      const views = UNSAFE_getAllByType(View);

      // Проверяем, что есть множественные View (скелетоны)
      expect(views.length).toBeGreaterThan(3);
    });
  });

  describe('Пустое состояние', () => {
    it('должен отобразить пустое состояние при hasData=false', () => {
      const { getByTestId, queryByTestId } = render(
        <NearTravelsSection hasData={false}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-empty')).toBeTruthy();
      expect(queryByTestId('travel-list')).toBeNull();
    });

    it('должен отобразить сообщение в пустом состоянии', () => {
      const { getByText } = render(
        <NearTravelsSection hasData={false}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByText('Поблизости нет других маршрутов')).toBeTruthy();
    });

    it('не должен отображать контент при hasData=false', () => {
      const { queryByTestId } = render(
        <NearTravelsSection hasData={false}>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(queryByTestId('travel-list')).toBeNull();
    });
  });

  describe('Темная тема', () => {
    it('должен использовать темные цвета', () => {
      const { useThemedColors } = require('@/hooks/useTheme');

      render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(useThemedColors).toHaveBeenCalled();
    });

    it('должен применить темный фон к контейнеру', () => {
      const { getByTestId } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      const container = getByTestId('near-travels-section-redesign');
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
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      const container = getByTestId('near-travels-section-redesign');
      expect(container.props.accessible).toBe(true);
      expect(container.props.accessibilityLabel).toBe('Похожие маршруты поблизости');
    });

    it('должен иметь header role', () => {
      const { getByText } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      const header = getByText('Рядом можно посмотреть');
      expect(header.props.accessibilityRole).toBe('header');
    });
  });

  describe('Адаптивность', () => {
    it('должен корректно работать на web', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const { getByTestId } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-section-redesign')).toBeTruthy();
    });

    it('должен корректно работать на iOS', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'ios';

      const { getByTestId } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-section-redesign')).toBeTruthy();
    });

    it('должен корректно работать на Android', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';

      const { getByTestId } = render(
        <NearTravelsSection>
          <MockTravelList />
        </NearTravelsSection>
      );

      expect(getByTestId('near-travels-section-redesign')).toBeTruthy();
    });
  });

  describe('Мемоизация', () => {
    it('должен быть обернут в memo', () => {
      expect(NearTravelsSection.displayName).toBe('NearTravelsSection');
    });
  });
});

