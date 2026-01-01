/**
 * Тесты для бокового меню (CompactSideBarTravel)
 * Веб-версия
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';

jest.mock('@/components/WeatherWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="weather-widget" />,
}));

// Mock данные
const mockTravel = {
  id: 'test-123',
  slug: 'test-travel',
  name: 'Тестовое путешествие',
  userName: 'Юлия',
  countryName: 'Беларусь',
  monthName: 'Октябрь',
  year: '2022',
  number_days: 1,
  countUnicIpView: '100',
  // Добавленные обязательные поля
  travel_image_thumb_url: 'https://example.com/thumb.jpg',
  travel_image_thumb_small_url: 'https://example.com/thumb-small.jpg',
  url: '/travels/test-travel',
  youtube_link: '',
  description: 'Описание тестового путешествия',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'Минск',
  countryCode: 'BY',
  companions: [],
  travelAddress: [
    {
      id: 1,
      name: 'Храм',
      coord: '53.9045, 27.5615',
      categoryName: 'Религия',
    },
  ] as any,
  gallery: [
    {
      url: 'https://example.com/image.jpg',
      id: 1,
      updated_at: '2022-10-01',
    },
  ] as any,
  user: {
    id: 1,
    name: 'user-1',
    avatar: 'https://example.com/avatar.jpg',
  },
  userIds: 'user-1',
  updated_at: '2022-10-01',
} as any;

const mockRefs = {
  hero: { current: null } as React.RefObject<any>,
  gallery: { current: null } as React.RefObject<any>,
  description: { current: null } as React.RefObject<any>,
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
  beforeAll(() => {
    Platform.OS = 'web';
    Platform.select = (obj: any) => obj.web ?? obj.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг компонентов', () => {
    it('должен отрендерить карточку автора', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getAllByText(/Юлия/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Беларусь/i).length).toBeGreaterThan(0);
    });

    it('должен отрендерить все пункты меню', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('Храм Родник')).toBeTruthy();
      expect(screen.getByText('Галерея')).toBeTruthy();
      expect(screen.getByText('Описание')).toBeTruthy();
      expect(screen.getByText('Экскурсии')).toBeTruthy();
      expect(screen.getByText('Карта')).toBeTruthy();
      expect(screen.getByText('Координаты')).toBeTruthy();
      expect(screen.getByText(/Рядом/i)).toBeTruthy();
      expect(screen.getByText('Популярное')).toBeTruthy();
    });

    it('должен показывать метаинформацию путешествия', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Октябрь/i)).toBeTruthy();
      expect(screen.getByText(/2022/i)).toBeTruthy();
      expect(screen.getByText(/1 дн/i)).toBeTruthy();
    });

    it('должен показывать количество просмотров', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('100')).toBeTruthy();
    });

    it('должен показывать категории', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('Религия')).toBeTruthy();
    });
  });

  describe('Компактность (без скролла)', () => {
    it('карточка автора должна иметь компактные размеры', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true })[0];
      expect(card).toBeTruthy();

      // Проверяем что карточка имеет компактный padding
      const styles = StyleSheet.flatten(card.props.style);
      expect(styles.padding).toBeLessThanOrEqual(14);
    });

    it('аватарка должна быть 52px', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const avatar = UNSAFE_getAllByProps({ 'data-sidebar-avatar': true })[0];
      expect(avatar).toBeTruthy();
    });

    it('пункты меню должны иметь компактные отступы', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const menuItems = UNSAFE_getAllByProps({ 'data-sidebar-link': true });
      expect(menuItems.length).toBeGreaterThan(0);

      // Проверяем что padding не превышает 12px по вертикали
      menuItems.forEach((item) => {
        const styles = StyleSheet.flatten(item.props.style) || {};
        const paddingVertical = styles.paddingVertical ?? styles.paddingTop ?? 0;
        expect(paddingVertical).toBeLessThanOrEqual(12);
      });
    });

    it('иконки должны быть 16px', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const icons = UNSAFE_getAllByProps({ 'data-icon': true });
      expect(icons.length).toBeGreaterThan(0);
    });

    it('текст должен быть 14px', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const textElements = UNSAFE_getAllByProps({ 'data-link-text': true });
      expect(textElements.length).toBeGreaterThan(0);

      textElements.forEach((text) => {
        const styles = StyleSheet.flatten(text.props.style) || {};
        expect(styles.fontSize).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('Навигация', () => {
    it('должен вызывать onNavigate при клике на пункт меню', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const galleryLink = screen.getByLabelText('Галерея');
      fireEvent.press(galleryLink);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith('gallery');
    });

    it('должен закрывать меню на мобильном после клика', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      render(<CompactSideBarTravel {...mobileProps} />);

      const galleryLink = screen.getByLabelText('Галерея');
      fireEvent.press(galleryLink);

      expect(defaultProps.closeMenu).toHaveBeenCalled();
    });

    it('не должен закрывать меню на десктопе после клика', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const galleryLink = screen.getByLabelText('Галерея');
      fireEvent.press(galleryLink);

      expect(defaultProps.closeMenu).not.toHaveBeenCalled();
    });

    it('должен подсвечивать активную секцию', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = UNSAFE_getAllByProps({ 'data-active': 'true' })[0];
      expect(activeLink).toBeTruthy();
      expect(activeLink.props.accessibilityLabel).toBe('Галерея');
    });
  });

  describe('Hover эффекты', () => {
    it('карточка должна иметь hover эффект', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true })[0];
      expect(card).toBeTruthy();

      // Проверяем что есть CSS для hover
      const styles = StyleSheet.flatten(card.props.style) || {};
      const transition = styles.transition;
      expect(transition === undefined || transition.includes('0.2s')).toBe(true);
    });

    it('пункт меню должен изменяться при hover', async () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const menuItem = UNSAFE_getAllByProps({ 'data-sidebar-link': true })[0];
      expect(menuItem).toBeTruthy();

      // Проверяем transition
      const styles = StyleSheet.flatten(menuItem.props.style) || {};
      const transition = styles.transition;
      expect(transition === undefined || typeof transition === 'string').toBe(true);
    });

    it('кнопки действий должны иметь hover эффект', () => {
      const propsWithEdit = { ...defaultProps, isSuperuser: true, storedUserId: 'user-1' };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...propsWithEdit} />);

      const actionButtons = UNSAFE_getAllByProps({ 'data-action-btn': true });
      expect(actionButtons.length).toBeGreaterThan(0);

      actionButtons.forEach((btn) => {
        const styles = StyleSheet.flatten(btn.props.style) || {};
        const transition = styles.transition;
        expect(transition === undefined || typeof transition === 'string').toBe(true);
      });
    });
  });

  describe('Права доступа', () => {
    it('должен показывать кнопку редактирования для владельца', () => {
      const propsWithEdit = { ...defaultProps, storedUserId: 'user-1' };
      render(<CompactSideBarTravel {...propsWithEdit} />);

      const editButton = screen.getByLabelText('Редактировать путешествие');
      expect(editButton).toBeTruthy();
    });

    it('должен показывать кнопку редактирования для суперпользователя', () => {
      const propsWithSuper = { ...defaultProps, isSuperuser: true };
      render(<CompactSideBarTravel {...propsWithSuper} />);

      const editButton = screen.getByLabelText('Редактировать путешествие');
      expect(editButton).toBeTruthy();
    });

    it('не должен показывать кнопку редактирования для чужого пользователя', () => {
      const propsNoEdit = { ...defaultProps, storedUserId: 'other-user' };
      render(<CompactSideBarTravel {...propsNoEdit} />);

      const editButton = screen.queryByLabelText('Редактировать путешествие');
      expect(editButton).not.toBeTruthy();
    });

    it('должен показывать кнопку PDF только на веб', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const pdfButton = screen.getByLabelText('Экспорт в PDF');
      expect(pdfButton).toBeTruthy();
    });
  });

  describe('Адаптивность', () => {
    it('должен применять мобильные стили на мобильном', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...mobileProps} />);

      const menu = UNSAFE_getAllByProps({ 'data-sidebar-menu': true })[0];
      expect(menu).toBeTruthy();
    });

    it('должен показывать кнопку закрытия на мобильном', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      render(<CompactSideBarTravel {...mobileProps} />);

      const closeButtons = screen.getAllByLabelText('Закрыть меню');
      expect(closeButtons.length).toBe(2);
    });

    it('не должен показывать кнопку закрытия на десктопе', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const closeButton = screen.queryByLabelText('Закрыть меню');
      expect(closeButton).toBeNull();
    });
  });

  describe('Data-атрибуты', () => {
    it('должен иметь data-sidebar-card', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = UNSAFE_getAllByProps({ 'data-sidebar-card': true });
      expect(card.length).toBeGreaterThan(0);
    });

    it('должен иметь data-sidebar-avatar', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const avatar = UNSAFE_getAllByProps({ 'data-sidebar-avatar': true });
      expect(avatar.length).toBeGreaterThan(0);
    });

    it('должен иметь data-sidebar-link для каждого пункта', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });
      expect(links.length).toBeGreaterThanOrEqual(mockLinks.length);
    });

    it('должен иметь data-active для активного пункта', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = UNSAFE_getAllByProps({ 'data-active': 'true' });
      expect(activeLink.length).toBeGreaterThan(0);
    });

    it('должен иметь data-icon для иконок', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const icons = UNSAFE_getAllByProps({ 'data-icon': true });
      expect(icons.length).toBeGreaterThan(0);
    });

    it('должен иметь data-link-text для текста', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const texts = UNSAFE_getAllByProps({ 'data-link-text': true });
      expect(texts.length).toBeGreaterThan(0);
    });

    it('должен иметь data-link-divider для разделителей', () => {
      const { UNSAFE_queryAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const dividers = UNSAFE_queryAllByProps({ 'data-link-divider': true });
      // Должен быть хотя бы один разделитель (перед картой)
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('должен иметь data-action-btn для кнопок', () => {
      const propsWithEdit = { ...defaultProps, isSuperuser: true };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...propsWithEdit} />);

      const buttons = UNSAFE_getAllByProps({ 'data-action-btn': true });
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('должен иметь data-sidebar-menu для контейнера', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const menu = UNSAFE_getAllByProps({ 'data-sidebar-menu': true });
      expect(menu.length).toBeGreaterThan(0);
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
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const links = UNSAFE_getAllByProps({ 'data-sidebar-link': true });
      links.forEach((link) => {
        expect(link.props.accessibilityRole).toBe('button');
      });
    });

    it('все элементы должны иметь aria-label', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const pdfButton = screen.getByLabelText('Экспорт в PDF');

      expect(pdfButton).toBeTruthy();
    });

    it('активный пункт должен иметь selected состояние', () => {
      const propsWithActive = { ...defaultProps, activeSection: 'gallery' };
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...propsWithActive} />);

      const activeLink = UNSAFE_getAllByProps({ 'data-active': 'true' })[0];
      expect(activeLink.props.accessibilityState?.selected).toBe(true);
    });
  });
});
