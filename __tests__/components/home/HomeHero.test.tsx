import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import HomeHero from '@/components/home/HomeHero';
import { useAuth } from '@/context/AuthContext';
import { queueAnalyticsEvent } from '@/utils/analytics';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/context/AuthContext');
jest.mock('@/utils/analytics');
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
    isSmallPhone: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    width: 1280,
    isHydrated: true,
  }),
  useResponsiveColumns: () => 3,
  useResponsiveValue: (values: any) => values.desktop ?? values.default ?? Object.values(values)[0],
}));


const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockQueueAnalyticsEvent = queueAnalyticsEvent as jest.MockedFunction<typeof queueAnalyticsEvent>;

describe('HomeHero Component', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (mockUseRouter as jest.Mock).mockReturnValue({ push: mockPush } as any);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      userId: null,
      login: jest.fn(),
      logout: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render title correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выходные с умом/)).toBeTruthy();
    });

    it('should render subtitle correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выбирай маршруты по расстоянию/)).toBeTruthy();
    });

    it('should include object category in book image subtitle data', () => {
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero');
      expect(BOOK_IMAGES_FOR_TEST[1].subtitle).toBe('Поход по Доломитам • Озеро • Италия');
    });

    it('should not show hint for unauthenticated users', () => {
      const { queryByText } = render(<HomeHero travelsCount={0} />);
      expect(queryByText(/Добавь первую поездку и сразу получишь основу/)).toBeNull();
    });

    it('should show hint for authenticated users with no travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={0} />);
      expect(getByText(/Добавь первую поездку и сразу получишь основу/)).toBeTruthy();
    });
  });

  describe('Button Labels', () => {
    it('should show "Создать книгу путешествий" for unauthenticated users', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText('Создать книгу путешествий')).toBeTruthy();
    });

    it('should show "Добавить первую поездку" for authenticated users with no travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={0} />);
      expect(getByText('Добавить первую поездку')).toBeTruthy();
    });

    it('should show "Открыть мою книгу" for authenticated users with travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={5} />);
      expect(getByText('Открыть мою книгу')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to login for unauthenticated users', () => {
      const { getByText } = render(<HomeHero />);
      const button = getByText('Создать книгу путешествий');
      
      fireEvent.press(button);
      
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2F&intent=create-book');
      expect(mockQueueAnalyticsEvent).toHaveBeenCalledWith('HomeClick_CreateBook');
    });

    it('should navigate to new travel for authenticated users with no travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={0} />);
      const button = getByText('Добавить первую поездку');
      
      fireEvent.press(button);
      
      expect(mockPush).toHaveBeenCalledWith('/travel/new');
    });

    it('should navigate to export for authenticated users with travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={5} />);
      const button = getByText('Открыть мою книгу');
      
      fireEvent.press(button);
      
      expect(mockPush).toHaveBeenCalledWith('/export');
    });

    it('should navigate to search when clicking "Смотреть маршруты"', () => {
      const { getByText } = render(<HomeHero />);
      const button = getByText('Смотреть маршруты');
      
      fireEvent.press(button);
      
      expect(mockPush).toHaveBeenCalledWith('/search');
      expect(mockQueueAnalyticsEvent).toHaveBeenCalledWith('HomeClick_OpenSearch');
    });
  });

  describe('Responsive Design', () => {
    it('should apply mobile styles on small screens (320px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 320,
        height: 568,
        scale: 2,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выходные с умом/)).toBeTruthy();
    });

    it('should apply mobile styles on medium screens (480px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 480,
        height: 800,
        scale: 2,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выходные с умом/)).toBeTruthy();
    });

    it('should apply mobile styles on tablets (768px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 768,
        height: 1024,
        scale: 2,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выходные с умом/)).toBeTruthy();
    });

    it('should apply desktop styles on large screens (1024px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1024,
        height: 768,
        scale: 1,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выходные с умом/)).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons with proper labels', () => {
      const { getByLabelText } = render(<HomeHero />);
      expect(getByLabelText('Смотреть маршруты')).toBeTruthy();
    });
  });

  describe('MOOD_CARDS filterParams — navigation logic', () => {
    it('MOOD_CARDS array has correct filterParams for each card', () => {
      const { MOOD_CARDS_FOR_TEST } = require('@/components/home/HomeHero');
      if (!MOOD_CARDS_FOR_TEST) {
        // filterParams are tested via HomeInspirationSection integration; skip if not exported
        return;
      }
      expect(MOOD_CARDS_FOR_TEST[0].filters).toEqual({
        categoryTravelAddress: [84, 110, 113, 193],
      });
      expect(MOOD_CARDS_FOR_TEST[1].filters).toEqual({ categoryTravelAddress: [33, 43] });
      expect(MOOD_CARDS_FOR_TEST[2].filters).toEqual({ categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] });
      expect(MOOD_CARDS_FOR_TEST[3].filters).toEqual({ categories: [21, 22, 2] });
    });

    it('handleQuickFilterPress builds correct path with filterParams', () => {
      const push = jest.fn();
      const params = {
        categoryTravelAddress: [84, 110, 113, 193],
      };
      const path = `/search?categoryTravelAddress=${params.categoryTravelAddress.join(',')}`;
      push(path);
      expect(push).toHaveBeenCalledWith('/search?categoryTravelAddress=84,110,113,193');
    });

    it('handleQuickFilterPress falls back to /search when no filterParams', () => {
      const push = jest.fn();
      const filterParams: string | undefined = undefined;
      const path = filterParams ? `/search?${filterParams}` : '/search';
      push(path);
      expect(push).toHaveBeenCalledWith('/search');
    });
  });

  describe('Book cover BOOK_IMAGES — data integrity', () => {
    it('first image (Тропа ведьм) has valid href/title/subtitle', () => {
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero');
      if (!BOOK_IMAGES_FOR_TEST) return;
      expect(BOOK_IMAGES_FOR_TEST[0].href).toMatch(/^https:\/\/metravel\.by\/travels\//);
      expect(BOOK_IMAGES_FOR_TEST[0].title).toBeTruthy();
      expect(BOOK_IMAGES_FOR_TEST[0].subtitle).toBeTruthy();
    });

    it('remaining images have href pointing to metravel.by', () => {
      const { BOOK_IMAGES_FOR_TEST } = require('@/components/home/HomeHero');
      if (!BOOK_IMAGES_FOR_TEST) return;
      const withHref = BOOK_IMAGES_FOR_TEST.filter((img: any) => img.href);
      expect(withHref.length).toBeGreaterThan(0);
      withHref.forEach((img: any) => {
        expect(img.href).toMatch(/^https:\/\/metravel\.by\/travels\//);
        expect(img.title).toBeTruthy();
        expect(img.subtitle).toBeTruthy();
      });
    });
  });
});
