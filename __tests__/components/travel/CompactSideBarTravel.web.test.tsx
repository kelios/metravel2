/**
 * Тесты для бокового меню (CompactSideBarTravel)
 * Веб-версия
 */

// Hoisted by jest. Forces Platform.OS = 'web' before SUT loads (module-level IS_WEB cache).
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN.Platform, 'OS', { value: 'web', configurable: true, writable: true });
  RN.Platform.select = (obj: any) => obj.web ?? obj.default;
  return RN;
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';

const mockDownloadBlobOnWeb: jest.Mock = jest.fn(() => true);
const mockDownloadTravelRouteFileBlob: jest.Mock = jest.fn(() =>
  Promise.resolve({ text: '<gpx></gpx>', contentType: 'application/gpx+xml', filename: 'route.gpx' })
);
const mockOpenExternalUrlInNewTab: jest.Mock = jest.fn(() => Promise.resolve(true));
const mockUseTravelRouteFiles: jest.Mock = jest.fn(() => ({
  data: [] as any[],
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
}));
const mockUseUserProfileCached: jest.Mock = jest.fn(() => ({
  profile: { avatar: 'https://example.com/profile-avatar.jpg' },
  isLoading: false,
  isFetching: false,
  error: null,
  fullName: '',
  refetch: jest.fn(),
}));

const mockAuthState = {
  isSuperuser: false,
  userId: null as string | null,
};

jest.mock('@/stores/authStore', () => ({
  __esModule: true,
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock('@/hooks/useUserProfileCached', () => ({
  __esModule: true,
  useUserProfileCached: (userId: unknown, options?: unknown) =>
    mockUseUserProfileCached(userId, options),
}));

jest.mock('@/hooks/useTravelRouteFiles', () => ({
  __esModule: true,
  useTravelRouteFiles: (travelId: unknown, options?: unknown) =>
    mockUseTravelRouteFiles(travelId, options),
}));

jest.mock('@/utils/externalLinks', () => ({
  __esModule: true,
  openExternalUrlInNewTab: (url: unknown, options?: unknown) =>
    mockOpenExternalUrlInNewTab(url, options),
}));

jest.mock('@/utils/downloadUrlOnWeb', () => ({
  __esModule: true,
  downloadBlobOnWeb: (blob: unknown, filename: unknown) =>
    mockDownloadBlobOnWeb(blob, filename),
}));

jest.mock('@/api/travelRoutes', () => ({
  __esModule: true,
  buildTravelRouteDownloadPath: (travelId: unknown, routeId: unknown) =>
    `/api/travels/${travelId}/routes/${routeId}/download/`,
  downloadTravelRouteFileBlob: (travelId: unknown, routeId: unknown) =>
    mockDownloadTravelRouteFileBlob(travelId, routeId),
}));

jest.mock('@/components/home/WeatherWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="weather-widget" />,
}));

jest.mock('@/components/ui/SubscribeButton', () => ({
  __esModule: true,
  default: () => <div data-testid="subscribe-button-mock" />,
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
  { key: 'map', label: 'Карта маршрута', icon: 'map' },
  { key: 'coordinates', label: 'Координаты мест', icon: 'place' },
  { key: 'nearby', label: 'Рядом можно посмотреть', icon: 'near_me', meta: '~60км' },
  { key: 'popular', label: 'Популярные маршруты', icon: 'star' },
];

const defaultProps = {
  refs: mockRefs,
  travel: mockTravel,
  isMobile: false,
  onNavigate: jest.fn(),
  closeMenu: jest.fn(),
  activeSection: '',
  links: mockLinks,
};

// Маркеры hover-правил `app/global.css` живут в `dataSet` (#2032): react-native-web
// переносит в DOM только его. Сырой `data-*` этот тест видел, а страница — нет,
// поэтому поиск идёт по `dataSet`; до DOM его доводит CompactSideBarTravel.dom.web.test.
const withDataSet = (root: any, key: string, value = 'true'): any[] =>
  root.findAll((node: any) => node.props?.dataSet?.[key] === value);

describe('CompactSideBarTravel - Web', () => {
  beforeAll(() => {
    Platform.OS = 'web';
    Platform.select = (obj: any) => obj.web ?? obj.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadBlobOnWeb.mockReturnValue(true);
    mockAuthState.isSuperuser = false;
    mockAuthState.userId = null;
    mockUseUserProfileCached.mockReturnValue({
      profile: { avatar: 'https://example.com/profile-avatar.jpg' },
      isLoading: false,
      isFetching: false,
      error: null,
      fullName: '',
      refetch: jest.fn(),
    });
    mockUseTravelRouteFiles.mockReturnValue({
      data: [] as any[],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe('Рендеринг компонентов', () => {
    it('сразу запрашивает профиль автора на десктопном web без hover', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(mockUseUserProfileCached).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ enabled: true })
      );
    });

    it('должен отрендерить карточку автора', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getAllByText(/Юлия/i).length).toBeGreaterThan(0);
    });

    it('должен отрендерить все пункты меню', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('Храм Родник')).toBeTruthy();
      expect(screen.getByText('Галерея')).toBeTruthy();
      expect(screen.getByText('Описание')).toBeTruthy();
      expect(screen.getByText('Экскурсии')).toBeTruthy();
      expect(screen.getByText('Карта маршрута')).toBeTruthy();
      expect(screen.getByText('Координаты мест')).toBeTruthy();
      expect(screen.getByText('Рядом можно посмотреть')).toBeTruthy();
      expect(screen.getByText('Популярные маршруты')).toBeTruthy();
    });

    it('должен показывать метаинформацию путешествия', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText(/Октябрь/i)).toBeTruthy();
      expect(screen.getByText(/2022/i)).toBeTruthy();
    });

    it('должен показывать количество просмотров', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.getByText('100')).toBeTruthy();
    });

    it('не должен показывать категории', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      expect(screen.queryByText('Религия')).toBeNull();
    });
  });

  describe('Компактность (без скролла)', () => {
    it('карточка автора должна иметь компактные размеры', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const card = withDataSet(UNSAFE_root, 'sidebarCard')[0];
      expect(card).toBeTruthy();

      // Проверяем что карточка имеет компактный padding
      const styles = StyleSheet.flatten(card.props.style);
      expect(styles.padding).toBeLessThanOrEqual(12);
    });

    it('аватарка должна быть компактной на desktop web', () => {
      const { UNSAFE_getAllByProps } = render(<CompactSideBarTravel {...defaultProps} />);

      const media = UNSAFE_getAllByProps({ alt: 'Юлия' })[0];
      expect(media).toBeTruthy();
      const styles = StyleSheet.flatten(media.props.style) || {};
      expect(styles.width).toBeLessThanOrEqual(40);
      expect(styles.height).toBeLessThanOrEqual(40);
    });

    it('действия автора имеют доступный touch-target (44px)', () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      const actionButton = screen.getByLabelText('Экспорт в PDF');
      const resolvedStyle =
        typeof actionButton.props.style === 'function'
          ? actionButton.props.style({ pressed: false, hovered: false })
          : actionButton.props.style;
      const styles = StyleSheet.flatten(resolvedStyle) || {};
      expect(styles.width).toBe(44);
      expect(styles.height).toBe(44);
    });

    it('пункты меню должны иметь компактные отступы', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const menuItems = withDataSet(UNSAFE_root, 'sidebarLink');
      expect(menuItems.length).toBeGreaterThan(0);

      // Проверяем что padding не превышает 12px по вертикали
      menuItems.forEach((item) => {
        const styles = StyleSheet.flatten(item.props.style) || {};
        const paddingVertical = styles.paddingVertical ?? styles.paddingTop ?? 0;
        expect(paddingVertical).toBeLessThanOrEqual(12);
      });
    });

    it('иконки пунктов меню компактные (18px на desktop)', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const icons = withDataSet(UNSAFE_root, 'sidebarLinkIcon').filter((node) => node.props.name);
      expect(icons.length).toBeGreaterThanOrEqual(mockLinks.length);
      icons.forEach((icon) => {
        expect(icon.props.size).toBeLessThanOrEqual(18);
      });
    });

    it('текст должен быть 14px', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const textElements = withDataSet(UNSAFE_root, 'sidebarLinkLabel');
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

      const activeLink = UNSAFE_getAllByProps({ 'aria-current': 'page' })[0];
      expect(activeLink).toBeTruthy();
      expect(activeLink.props.accessibilityLabel).toBe('Галерея');
    });

    it('должен скачивать маршрут через уже загруженный route file без повторного запроса списка', async () => {
      mockUseTravelRouteFiles.mockReturnValue({
        data: [
          {
            id: 77,
            ext: 'gpx',
            original_name: 'route.gpx',
            download_url: '/api/travels/test-123/routes/77/download/',
          },
        ] as any[],
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompactSideBarTravel {...defaultProps} />);

      const downloadButton = await screen.findByLabelText('Скачать маршрут');
      fireEvent.press(downloadButton);

      await waitFor(() => {
        expect(mockDownloadTravelRouteFileBlob).toHaveBeenCalledWith(
          'test-123',
          77
        );
      });
      expect(mockDownloadBlobOnWeb).toHaveBeenCalled();
      expect(mockOpenExternalUrlInNewTab).not.toHaveBeenCalled();
      expect(defaultProps.onNavigate).not.toHaveBeenCalledWith('download-route');
    });
  });

  describe('Hover эффекты (маркеры правил app/global.css)', () => {
    it('каждый пункт меню и «Скачать маршрут» несут маркер sidebarLink', async () => {
      mockUseTravelRouteFiles.mockReturnValue({
        data: [{ id: 77, ext: 'gpx', original_name: 'route.gpx' }] as any[],
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: jest.fn(),
      });
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);
      await screen.findByLabelText('Скачать маршрут');

      const labels = new Set(
        withDataSet(UNSAFE_root, 'sidebarLink').map((node) => node.props.accessibilityLabel),
      );
      expect(labels).toEqual(new Set([...mockLinks.map((link) => link.label), 'Скачать маршрут']));
    });

    it('иконка и подпись пункта помечены для цвета при наведении', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const labels = withDataSet(UNSAFE_root, 'sidebarLinkLabel').map((node) => node.props.children);
      expect(labels).toEqual(expect.arrayContaining(mockLinks.map((link) => link.label)));
      expect(withDataSet(UNSAFE_root, 'sidebarLinkIcon').filter((node) => node.props.name)).toHaveLength(
        mockLinks.length,
      );
    });

    it('активный пункт узнаётся по aria-current — hover-правило его не перекрашивает', () => {
      const { UNSAFE_root } = render(
        <CompactSideBarTravel {...defaultProps} activeSection="gallery" />,
      );

      const current = withDataSet(UNSAFE_root, 'sidebarLink').filter(
        (node) => node.props['aria-current'] === 'page',
      );
      expect(current.length).toBeGreaterThan(0);
      current.forEach((node) => expect(node.props.accessibilityLabel).toBe('Галерея'));
    });

    it('карточка автора несёт маркер sidebarCard', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      expect(withDataSet(UNSAFE_root, 'sidebarCard').length).toBeGreaterThan(0);
    });
  });

  describe('Права доступа', () => {
    it('должен показывать кнопку редактирования для владельца', async () => {
      mockAuthState.userId = 'user-1';
      const propsWithEdit = { ...defaultProps };
      render(<CompactSideBarTravel {...propsWithEdit} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Редактировать путешествие')).toBeTruthy();
      });
    });

    it('должен показывать кнопку редактирования для суперпользователя', async () => {
      mockAuthState.isSuperuser = true;
      const propsWithSuper = { ...defaultProps };
      render(<CompactSideBarTravel {...propsWithSuper} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Редактировать путешествие')).toBeTruthy();
      });
    });

    it('не должен показывать кнопку редактирования для чужого пользователя', () => {
      mockAuthState.userId = 'other-user';
      const propsNoEdit = { ...defaultProps };
      render(<CompactSideBarTravel {...propsNoEdit} />);

      const editButton = screen.queryByLabelText('Редактировать путешествие');
      expect(editButton).not.toBeTruthy();
    });

    it('должен показывать кнопку PDF только на веб', async () => {
      render(<CompactSideBarTravel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Экспорт в PDF')).toBeTruthy();
      });
    });
  });

  describe('Адаптивность', () => {
    it('должен применять мобильные стили на мобильном', () => {
      const mobileProps = { ...defaultProps, isMobile: true };
      render(<CompactSideBarTravel {...mobileProps} />);

      expect(screen.getByTestId('travel-details-sidebar-menu')).toBeTruthy();
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

  describe('Маркеры web-стилей', () => {
    it('сайдбар не ставит сырых data-* — react-native-web отбрасывает их до DOM', () => {
      mockAuthState.isSuperuser = true;
      mockAuthState.userId = 'user-1';
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      // Маркеры, которые сайдбар, карточка автора, её кнопки и виджет погоды ставили
      // сырым пропом до #2032. Чужой долг вложенных общих компонентов (например,
      // `data-testid` скелетона картинки) ведёт guard:web-style-channels.
      const SIDEBAR_MARKERS = /^data-(?:sidebar|link|icon|active|action-btn|author-name|disabled|weather)/;
      const rawDataProps = UNSAFE_root
        .findAll(() => true)
        .flatMap((node: any) => Object.keys(node.props || {}).filter((key) => SIDEBAR_MARKERS.test(key)));
      expect(rawDataProps).toEqual([]);
    });

    it('разделитель перед картой рендерится', () => {
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const dividers = UNSAFE_root.findAll(
        (node: any) =>
          typeof node.type === 'string' &&
          String(StyleSheet.flatten(node.props.style)?.backgroundImage ?? '').startsWith('linear-gradient(90deg'),
      );
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Производительность', () => {
    it('должен рендериться быстро (< 400ms)', () => {
      const start = performance.now();
      render(<CompactSideBarTravel {...defaultProps} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(400);
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
      const { UNSAFE_root } = render(<CompactSideBarTravel {...defaultProps} />);

      const links = withDataSet(UNSAFE_root, 'sidebarLink');
      expect(links.length).toBeGreaterThan(0);
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

      const activeLink = UNSAFE_getAllByProps({ 'aria-current': 'page' })[0];
      expect(activeLink.props['aria-pressed']).toBe(true);
    });
  });
});
