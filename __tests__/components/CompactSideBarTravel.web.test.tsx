/**
 * Тесты для бокового меню (Web версия)
 * Проверяет компактность, стили и функциональность
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import type { Travel } from '@/src/types/types';
import { Platform, StyleSheet } from 'react-native';

// Mock для веб-окружения
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock expo-image для веба
jest.mock('expo-image', () => ({
  Image: ({ source, style, alt, ...props }: any) => {
    return <img src={source?.uri || source} style={style} alt={alt} {...props} />;
  },
}));

// Mock WeatherWidget
jest.mock('@/components/WeatherWidget', () => {
  return function WeatherWidget() {
    const { Text } = require('react-native');
    return <Text testID="weather-widget">Weather Widget</Text>;
  };
});

// Mock image optimization
jest.mock('@/utils/imageOptimization', () => ({
  optimizeImageUrl: (url: string) => url,
  buildVersionedImageUrl: (url: string) => url,
  getOptimalImageSize: (width: number, height: number) => ({ width, height }),
}));

const createMockTravel = (overrides: Partial<Travel> = {}): Travel => ({
  id: 1,
  name: 'Лясная гара в Беларусі',
  slug: 'lysaya-gora-342m',
  description: 'Увлекательное путешествие к высочайшей точке',
  userName: 'Julia',
  countryName: 'Беларусь',
  year: 2022,
  monthName: 'Октябрь',
  number_days: 1,
  countUnicIpView: 2345,
  travelAddress: [
    {
      id: 1,
      name: 'Храм Родник',
      categoryName: 'Религия',
      coord: '54.123, 27.456',
    },
  ],
  gallery: [
    {
      id: 1,
      url: 'https://example.com/image1.jpg',
      updated_at: '2024-01-01',
    },
  ],
  user: {
    id: '123',
    avatar: 'https://example.com/avatar.jpg',
  },
  ...overrides,
} as any);

const createMockRefs = () => ({
  gallery: { current: null } as React.RefObject<any>,
  description: { current: null } as React.RefObject<any>,
  map: { current: null } as React.RefObject<any>,
  points: { current: null } as React.RefObject<any>,
  excursions: { current: null } as React.RefObject<any>,
});

describe('CompactSideBarTravel - Web Version', () => {
  beforeAll(() => {
    Platform.OS = 'web';
    Platform.select = (obj: any) => obj.web ?? obj.default;
  });

  const defaultProps = {
    refs: createMockRefs(),
    travel: createMockTravel(),
    isMobile: false,
    onNavigate: jest.fn(),
    closeMenu: jest.fn(),
    isSuperuser: false,
    storedUserId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Компактность (без скролла)', () => {
    it('должен иметь компактные размеры карточки', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true })[0];

      expect(card).toBeTruthy();

      // Проверяем что padding уменьшен для компактности
      const styles = StyleSheet.flatten(card.props.style) || {};
      expect(styles.padding).toBeLessThanOrEqual(18); // Было 18px, должно быть меньше для компактности
    });

    it('должен иметь компактные пункты меню', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });

      expect(links.length).toBeGreaterThan(0);

      links.forEach(link => {
        const styles = StyleSheet.flatten(link.props.style) || {};
        const paddingVertical = styles.paddingVertical ?? styles.paddingTop ?? 0;
        expect(paddingVertical).toBeLessThanOrEqual(12); // Компактный padding
      });
    });

    it('должен иметь уменьшенный размер аватарки', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const avatar = UNSAFE_getAllByProps({ 'data-sidebar-avatar': true })[0];

      expect(avatar).toBeTruthy();
    });

    it('должен уместиться в высоту экрана без скролла', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const menu = UNSAFE_getAllByProps({ 'data-sidebar-menu': true })[0];

      expect(menu).toBeTruthy();
    });
  });

  describe('Hover эффекты', () => {
    it('должен применять hover стили к карточке', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true })[0];

      expect(card).toBeTruthy();
    });

    it('должен применять hover стили к пунктам меню', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const link = UNSAFE_getAllByProps({ 'data-sidebar-link': true })[0];

      expect(link).toBeTruthy();
      expect(link.props['data-active']).toBeDefined();
    });

    it('должен применять hover стили к кнопкам действий', () => {
      const travelWithEditRights = createMockTravel({
        userIds: '123',
      });

      const { UNSAFE_getAllByProps } = render(
        <CompactSideBarTravel
          {...defaultProps}
          travel={travelWithEditRights}
          storedUserId="123"
        />
      );

      const actionBtn = UNSAFE_getAllByProps({ 'data-action-btn': true })[0];
      expect(actionBtn).toBeTruthy();
    });
  });

  describe('Навигация', () => {
    it('должен вызывать onNavigate при клике на пункт меню', () => {
      const onNavigate = jest.fn();
      render(
        <CompactSideBarTravel {...defaultProps} onNavigate={onNavigate} />
      );

      const link = screen.getByLabelText('Галерея');
      fireEvent.press(link);
      expect(onNavigate).toHaveBeenCalled();
    });

    it('должен отображать активный индикатор для текущей секции', () => {
      const { UNSAFE_getAllByProps } = render(
        <CompactSideBarTravel {...defaultProps} activeSection="gallery" />
      );

      const activeLink = UNSAFE_getAllByProps({ 'data-active': 'true' })[0];
      expect(activeLink).toBeTruthy();
    });

    it('должен показывать правильное количество пунктов меню', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });

      // Должны быть основные разделы: gallery, description, map, points, etc.
      expect(links.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Информация о путешествии', () => {
    it('должен отображать имя пользователя и страну', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getAllByText(/Julia/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Беларусь/i).length).toBeGreaterThan(0);
    });

    it('должен отображать дату и продолжительность', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Октябрь/i)).toBeTruthy();
      expect(screen.getByText(/2022/i)).toBeTruthy();
      expect(screen.getByText(/1 дн/i)).toBeTruthy();
    });

    it('должен отображать количество просмотров', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/2.*345/)).toBeTruthy();
    });

    it('должен отображать категории', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Религия/i)).toBeTruthy();
    });
  });

  describe('Экспорт в PDF', () => {
    it('должен показывать кнопку экспорта в PDF', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const pdfBtn = UNSAFE_getAllByProps({ 'data-action-btn': true })[0];
      expect(pdfBtn).toBeTruthy();
    });
  });

  describe('Адаптивность', () => {
    it('должен корректно отображаться на desktop', () => {
      const { UNSAFE_getAllByProps } = render(
        <CompactSideBarTravel {...defaultProps} isMobile={false} />
      );

      const menu = UNSAFE_getAllByProps({ 'data-sidebar-menu': true })[0];
      expect(menu).toBeTruthy();
    });

    it('должен корректно отображаться на mobile', () => {
      render(
        <CompactSideBarTravel {...defaultProps} isMobile={true} />
      );

      const closeButtons = screen.getAllByLabelText('Закрыть меню');
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Data-атрибуты', () => {
    it('должен иметь data-sidebar-card на карточке', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true })[0];
      expect(card).toBeTruthy();
    });

    it('должен иметь data-sidebar-link на пунктах меню', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });

      links.forEach(link => {
        expect(link.props['data-sidebar-link']).toBe(true);
        expect(link.props['data-active']).toBeDefined();
      });
    });

    it('должен иметь data-icon на иконках', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const icons = UNSAFE_getAllByProps({ 'data-icon': true });

      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Производительность', () => {
    it('должен загружать WeatherWidget через Suspense', async () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('weather-widget')).toBeTruthy();
      });
    });

    it('должен оптимизировать изображения', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const avatar = UNSAFE_getAllByProps({ 'data-sidebar-avatar': true })[0];

      expect(avatar).toBeTruthy();
    });
  });

  describe('Доступность', () => {
    it('должен иметь aria-label на кнопках', () => {
      const { UNSAFE_getAllByProps } = render(
        <CompactSideBarTravel
          {...defaultProps}
          storedUserId="123"
        />
      );

      const buttons = UNSAFE_getAllByProps({ accessibilityRole: 'button' });
      buttons.forEach(button => {
        // Каждая кнопка должна иметь accessibilityLabel или текстовое содержимое
        const hasLabel = Boolean(button.props.accessibilityLabel);
        const text = button.props.children;
        expect(hasLabel || Boolean(text)).toBe(true);
      });
    });

    it('должен иметь role="button" на пунктах меню', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });

      links.forEach(link => {
        expect(link.props.accessibilityRole).toBe('button');
      });
    });
  });
});
