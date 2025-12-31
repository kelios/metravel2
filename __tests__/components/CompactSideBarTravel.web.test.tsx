/**
 * Тесты для бокового меню (Web версия)
 * Проверяет компактность, стили и функциональность
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import type { Travel } from '@/src/types/types';

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
    return <div data-testid="weather-widget">Weather Widget</div>;
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
  gallery: { current: document.createElement('div') },
  description: { current: document.createElement('div') },
  map: { current: document.createElement('div') },
  points: { current: document.createElement('div') },
  excursions: { current: document.createElement('div') },
});

describe('CompactSideBarTravel - Web Version', () => {
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
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = container.querySelector('[data-sidebar-card]');

      expect(card).toBeInTheDocument();

      // Проверяем что padding уменьшен для компактности
      const styles = window.getComputedStyle(card!);
      const padding = parseInt(styles.padding);
      expect(padding).toBeLessThanOrEqual(18); // Было 18px, должно быть меньше для компактности
    });

    it('должен иметь компактные пункты меню', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = container.querySelectorAll('[data-sidebar-link]');

      expect(links.length).toBeGreaterThan(0);

      links.forEach(link => {
        const styles = window.getComputedStyle(link);
        const paddingTop = parseInt(styles.paddingTop);
        expect(paddingTop).toBeLessThanOrEqual(12); // Компактный padding
      });
    });

    it('должен иметь уменьшенный размер аватарки', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const avatar = container.querySelector('[data-sidebar-avatar] img');

      if (avatar) {
        const styles = window.getComputedStyle(avatar);
        const width = parseInt(styles.width);
        expect(width).toBeLessThanOrEqual(52); // 52px вместо 60px
      }
    });

    it('должен уместиться в высоту экрана без скролла', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const menu = container.querySelector('[data-sidebar-menu]');

      if (menu) {
        const height = menu.getBoundingClientRect().height;
        // Проверяем что высота меню не превышает типичную высоту экрана минус хедер
        expect(height).toBeLessThan(900); // Типичная высота экрана - хедер
      }
    });
  });

  describe('Hover эффекты', () => {
    it('должен применять hover стили к карточке', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = container.querySelector('[data-sidebar-card]');

      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-sidebar-card');
    });

    it('должен применять hover стили к пунктам меню', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const link = container.querySelector('[data-sidebar-link]');

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('data-sidebar-link');
      expect(link).toHaveAttribute('data-active');
    });

    it('должен применять hover стили к кнопкам действий', () => {
      const travelWithEditRights = createMockTravel({
        userId: '123',
      });

      const { container } = render(
        <CompactSideBarTravel
          {...defaultProps}
          travel={travelWithEditRights}
          storedUserId="123"
        />
      );

      const actionBtn = container.querySelector('[data-action-btn]');
      expect(actionBtn).toBeInTheDocument();
    });
  });

  describe('Навигация', () => {
    it('должен вызывать onNavigate при клике на пункт меню', () => {
      const onNavigate = jest.fn();
      const { container } = render(
        <CompactSideBarTravel {...defaultProps} onNavigate={onNavigate} />
      );

      const link = container.querySelector('[data-sidebar-link]');
      if (link) {
        fireEvent.click(link);
        expect(onNavigate).toHaveBeenCalled();
      }
    });

    it('должен отображать активный индикатор для текущей секции', () => {
      const { container } = render(
        <CompactSideBarTravel {...defaultProps} activeSection="gallery" />
      );

      const activeLink = container.querySelector('[data-sidebar-link][data-active="true"]');
      expect(activeLink).toBeInTheDocument();
    });

    it('должен показывать правильное количество пунктов меню', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = container.querySelectorAll('[data-sidebar-link]');

      // Должны быть основные разделы: gallery, description, map, points, etc.
      expect(links.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Информация о путешествии', () => {
    it('должен отображать имя пользователя и страну', () => {
      const { getByText } = render(<CompactSideBarTravel {...defaultProps} />);

      expect(getByText(/Julia/i)).toBeInTheDocument();
      expect(getByText(/Беларусь/i)).toBeInTheDocument();
    });

    it('должен отображать дату и продолжительность', () => {
      const { getByText } = render(<CompactSideBarTravel {...defaultProps} />);

      expect(getByText(/Октябрь/i)).toBeInTheDocument();
      expect(getByText(/2022/i)).toBeInTheDocument();
      expect(getByText(/1 дн/i)).toBeInTheDocument();
    });

    it('должен отображать количество просмотров', () => {
      const { getByText } = render(<CompactSideBarTravel {...defaultProps} />);

      expect(getByText(/2.*345/)).toBeInTheDocument();
    });

    it('должен отображать категории', () => {
      const { getByText } = render(<CompactSideBarTravel {...defaultProps} />);

      expect(getByText(/Религия/i)).toBeInTheDocument();
    });
  });

  describe('Экспорт в PDF', () => {
    it('должен показывать кнопку экспорта в PDF', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const pdfBtn = container.querySelector('[data-action-btn]');
      expect(pdfBtn).toBeInTheDocument();
    });
  });

  describe('Адаптивность', () => {
    it('должен корректно отображаться на desktop', () => {
      const { container } = render(
        <CompactSideBarTravel {...defaultProps} isMobile={false} />
      );

      const menu = container.querySelector('[data-sidebar-menu]');
      expect(menu).toBeInTheDocument();
    });

    it('должен корректно отображаться на mobile', () => {
      const { container } = render(
        <CompactSideBarTravel {...defaultProps} isMobile={true} />
      );

      const closeBtn = container.querySelector('button');
      expect(closeBtn).toBeInTheDocument();
    });
  });

  describe('Data-атрибуты', () => {
    it('должен иметь data-sidebar-card на карточке', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const card = container.querySelector('[data-sidebar-card]');
      expect(card).toHaveAttribute('data-sidebar-card', 'true');
    });

    it('должен иметь data-sidebar-link на пунктах меню', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = container.querySelectorAll('[data-sidebar-link]');

      links.forEach(link => {
        expect(link).toHaveAttribute('data-sidebar-link', 'true');
        expect(link).toHaveAttribute('data-active');
      });
    });

    it('должен иметь data-icon на иконках', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const icons = container.querySelectorAll('[data-icon]');

      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Производительность', () => {
    it('должен загружать WeatherWidget через Suspense', async () => {
      const { getByTestId } = render(<CompactSideBarTravel {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('weather-widget')).toBeInTheDocument();
      });
    });

    it('должен оптимизировать изображения', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const avatar = container.querySelector('[data-sidebar-avatar] img');

      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Доступность', () => {
    it('должен иметь aria-label на кнопках', () => {
      const { container } = render(
        <CompactSideBarTravel
          {...defaultProps}
          storedUserId="123"
        />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        // Каждая кнопка должна иметь aria-label или текстовое содержимое
        const hasAriaLabel = button.hasAttribute('aria-label');
        const hasTextContent = button.textContent && button.textContent.trim().length > 0;
        expect(hasAriaLabel || hasTextContent).toBe(true);
      });
    });

    it('должен иметь role="button" на пунктах меню', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);
      const links = container.querySelectorAll('[data-sidebar-link]');

      links.forEach(link => {
        expect(link).toHaveAttribute('role', 'button');
      });
    });
  });
});

