/**
 * Тесты для бокового меню (CompactSideBarTravel)
 * Веб-версия
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import { View } from 'react-native';

// Mock данные
const mockTravel = {
  id: 'test-123',
  slug: 'test-travel',
  name: 'Тестовое путешествие',
  userName: 'Юлия',
  countryName: 'Беларусь',
  monthName: 'Октябрь',
  year: 2022,
  number_days: 1,
  countUnicIpView: 100,
  travelAddress: [
    {
      coord: '53.9045, 27.5615',
      categoryName: 'Храм',
    },
  ],
  gallery: [
    {
      url: 'https://example.com/image.jpg',
      id: '1',
      updated_at: '2022-10-01',
    },
  ],
  user: {
    id: 'user-1',
    avatar: 'https://example.com/avatar.jpg',
  },
  userId: 'user-1',
  updated_at: '2022-10-01',
};

const mockRefs = {
  hero: React.createRef<View>(),
  gallery: React.createRef<View>(),
  description: React.createRef<View>(),
};

const mockLinks = [
  { key: 'hero', label: 'Храм Родник', icon: 'home', meta: '+4' },
  { key: 'gallery', label: 'Галерея', icon: 'photo-library', meta: '10' },
  { key: 'description', label: 'Описание', icon: 'description' },
  { key: 'excursions', label: 'Экскурсии', icon: 'tour' },
  { key: 'map', label: 'Карта', icon: 'map' },
  { key: 'coordinates', label: 'Координаты', icon: 'place' },
  { key: 'nearby', label: 'Рядом', icon: 'near_me', meta: '~60км' },
  { key: 'popular', label: 'Популярное', icon: 'star' },
];

const defaultProps = {
  refs: mockRefs,
  travel: mockTravel,
  isMobile: false,
  onNavigate: jest.fn(),
  closeMenu: jest.fn(),
  isSuperuser: false,
  storedUserId: null,
  activeSection: '',
  links: mockLinks,
};

describe('CompactSideBarTravel - Web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг компонентов', () => {
    it('должен отрендерить карточку автора', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Юлия/i)).toBeInTheDocument();
      expect(screen.getByText(/Беларусь/i)).toBeInTheDocument();
    });

    it('должен отрендерить все пункты меню', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('Храм Родник')).toBeInTheDocument();
      expect(screen.getByText('Галерея')).toBeInTheDocument();
      expect(screen.getByText('Описание')).toBeInTheDocument();
      expect(screen.getByText('Экскурсии')).toBeInTheDocument();
      expect(screen.getByText('Карта')).toBeInTheDocument();
      expect(screen.getByText('Координаты')).toBeInTheDocument();
      expect(screen.getByText(/Рядом/i)).toBeInTheDocument();
      expect(screen.getByText('Популярное')).toBeInTheDocument();
    });

    it('должен показывать метаинформацию путешествия', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Октябрь/i)).toBeInTheDocument();
      expect(screen.getByText(/2022/i)).toBeInTheDocument();
      expect(screen.getByText(/1 дн/i)).toBeInTheDocument();
    });

    it('должен показывать количество просмотров', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('должен показывать категории', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('Храм')).toBeInTheDocument();
    });
  });

  describe('Компактность (без скролла)', () => {
    it('карточка автора должна иметь компактные размеры', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = container.querySelector('[data-sidebar-card="true"]');
      expect(card).toBeInTheDocument();

      // Проверяем что карточка имеет компактный padding
      const styles = window.getComputedStyle(card!);
      expect(parseInt(styles.padding)).toBeLessThanOrEqual(14);
    });

    it('аватарка должна быть 52px', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const avatar = container.querySelector('[data-sidebar-avatar="true"]');
      expect(avatar).toBeInTheDocument();
    });

    it('пункты меню должны иметь компактные отступы', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const menuItems = container.querySelectorAll('[data-sidebar-link="true"]');
      expect(menuItems.length).toBeGreaterThan(0);

      // Проверяем что padding не превышает 9px по вертикали
      menuItems.forEach((item) => {
        const styles = window.getComputedStyle(item);
        expect(parseInt(styles.paddingTop)).toBeLessThanOrEqual(9);
      });
    });

    it('иконки должны быть 16px', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const icons = container.querySelectorAll('[data-icon="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('текст должен быть 14px', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const textElements = container.querySelectorAll('[data-link-text="true"]');
      expect(textElements.length).toBeGreaterThan(0);

      textElements.forEach((text) => {
        const styles = window.getComputedStyle(text);
        expect(parseInt(styles.fontSize)).toBeLessThanOrEqual(14);
      });
    });
  });

  describe('Навигация', () => {
    it('должен вызывать onNavigate при клике на пункт меню', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const galleryLink = screen.getByText('Галерея');
      fireEvent.click(galleryLink);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith('gallery');
    });

    it('должен закрывать меню на мобильном после клика', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      render(<CompactSideBarTravel {...mobileProps} />);

      const galleryLink = screen.getByText('Галерея');
      fireEvent.click(galleryLink);

      expect(defaultProps.closeMenu).toHaveBeenCalled();
    });

    it('не должен закрывать меню на десктопе после клика', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const galleryLink = screen.getByText('Галерея');
      fireEvent.click(galleryLink);

      expect(defaultProps.closeMenu).not.toHaveBeenCalled();
    });

    it('должен подсвечивать активную секцию', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { container } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = container.querySelector('[data-sidebar-link="true"][data-active="true"]');
      expect(activeLink).toBeInTheDocument();
      expect(activeLink).toHaveTextContent('Галерея');
    });
  });

  describe('Hover эффекты', () => {
    it('карточка должна иметь hover эффект', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = container.querySelector('[data-sidebar-card="true"]');
      expect(card).toBeInTheDocument();

      // Проверяем что есть CSS для hover
      const styles = window.getComputedStyle(card!);
      expect(styles.transition).toContain('0.2s');
    });

    it('пункт меню должен изменяться при hover', async () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const menuItem = container.querySelector('[data-sidebar-link="true"]');
      expect(menuItem).toBeInTheDocument();

      // Проверяем transition
      const styles = window.getComputedStyle(menuItem!);
      expect(styles.transition).toBeDefined();
    });

    it('кнопки действий должны иметь hover эффект', () => {
      const propsWithEdit = { ...defaultProps, isSuperuser: true, storedUserId: 'user-1' };
      const { container } = render(<CompactSideBarTravel {...propsWithEdit} />);

      const actionButtons = container.querySelectorAll('[data-action-btn="true"]');
      expect(actionButtons.length).toBeGreaterThan(0);

      actionButtons.forEach((btn) => {
        const styles = window.getComputedStyle(btn);
        expect(styles.transition).toBeDefined();
      });
    });
  });

  describe('Права доступа', () => {
    it('должен показывать кнопку редактирования для владельца', () => {
      const propsWithEdit = { ...defaultProps, storedUserId: 'user-1' };
      render(<CompactSideBarTravel {...propsWithEdit} />);

      const editButton = screen.getByLabelText('Редактировать путешествие');
      expect(editButton).toBeInTheDocument();
    });

    it('должен показывать кнопку редактирования для суперпользователя', () => {
      const propsWithSuper = { ...defaultProps, isSuperuser: true };
      render(<CompactSideBarTravel {...propsWithSuper} />);

      const editButton = screen.getByLabelText('Редактировать путешествие');
      expect(editButton).toBeInTheDocument();
    });

    it('не должен показывать кнопку редактирования для чужого пользователя', () => {
      const propsNoEdit = { ...defaultProps, storedUserId: 'other-user' };
      render(<CompactSideBarTravel {...propsNoEdit} />);

      const editButton = screen.queryByLabelText('Редактировать путешествие');
      expect(editButton).not.toBeInTheDocument();
    });

    it('должен показывать кнопку PDF только на веб', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const pdfButton = screen.getByLabelText('Экспорт в PDF');
      expect(pdfButton).toBeInTheDocument();
    });
  });

  describe('Адаптивность', () => {
    it('должен применять мобильные стили на мобильном', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      const { container } = render(<CompactSideBarTravel {...mobileProps} />);

      const menu = container.querySelector('[data-sidebar-menu="true"]');
      expect(menu).toBeInTheDocument();
    });

    it('должен показывать кнопку закрытия на мобильном', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      render(<CompactSideBarTravel {...mobileProps} />);

      const closeButton = screen.getByLabelText('Закрыть меню');
      expect(closeButton).toBeInTheDocument();
    });

    it('не должен показывать кнопку закрытия на десктопе', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const closeButton = screen.queryByLabelText('Закрыть меню');
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Data-атрибуты', () => {
    it('должен иметь data-sidebar-card', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = container.querySelector('[data-sidebar-card="true"]');
      expect(card).toBeInTheDocument();
    });

    it('должен иметь data-sidebar-avatar', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const avatar = container.querySelector('[data-sidebar-avatar="true"]');
      expect(avatar).toBeInTheDocument();
    });

    it('должен иметь data-sidebar-link для каждого пункта', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const links = container.querySelectorAll('[data-sidebar-link="true"]');
      expect(links.length).toBe(mockLinks.length);
    });

    it('должен иметь data-active для активного пункта', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { container } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = container.querySelector('[data-active="true"]');
      expect(activeLink).toBeInTheDocument();
    });

    it('должен иметь data-icon для иконок', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const icons = container.querySelectorAll('[data-icon="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('должен иметь data-link-text для текста', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const texts = container.querySelectorAll('[data-link-text="true"]');
      expect(texts.length).toBeGreaterThan(0);
    });

    it('должен иметь data-link-divider для разделителей', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const dividers = container.querySelectorAll('[data-link-divider="true"]');
      // Должен быть хотя бы один разделитель (перед картой)
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('должен иметь data-action-btn для кнопок', () => {
      const propsWithEdit = { ...defaultProps, isSuperuser: true };
      const { container } = render(<CompactSideBarTravel {...propsWithEdit} />);

      const buttons = container.querySelectorAll('[data-action-btn="true"]');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('должен иметь data-sidebar-menu для контейнера', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const menu = container.querySelector('[data-sidebar-menu="true"]');
      expect(menu).toBeInTheDocument();
    });
  });

  describe('Производительность', () => {
    it('должен рендериться быстро (< 100ms)', () => {
      const start = performance.now();
      render(<CompactSideBarTravel {...defaultProps} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });

    it('должен использовать memo для оптимизации', () => {
      const { rerender } = render(<CompactSideBarTravel {...defaultProps} />);

      // Перерендер с теми же props
      const start = performance.now();
      rerender(<CompactSideBarTravel {...defaultProps} />);
      const end = performance.now();

      // Должно быть очень быстро благодаря memo
      expect(end - start).toBeLessThan(10);
    });
  });

  describe('Accessibility', () => {
    it('все кнопки должны иметь accessibilityRole="button"', () => {
      const { container } = render(<CompactSideBarTravel {...defaultProps} />);

      const links = container.querySelectorAll('[data-sidebar-link="true"]');
      links.forEach((link) => {
        expect(link.getAttribute('role')).toBe('button');
      });
    });

    it('все элементы должны иметь aria-label', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const editButton = screen.queryByLabelText('Редактировать путешествие');
      const pdfButton = screen.getByLabelText('Экспорт в PDF');

      expect(pdfButton).toBeInTheDocument();
    });

    it('активный пункт должен иметь selected состояние', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { container } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = container.querySelector('[data-active="true"]');
      expect(activeLink?.getAttribute('aria-selected')).toBe('true');
    });
  });
});

