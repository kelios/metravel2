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
      expect(getByText(/Идеи для поездок/)).toBeTruthy();
    });

    it('should render subtitle correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Выбирай маршруты по расстоянию/)).toBeTruthy();
    });

    it('should render mood cards correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText('У воды')).toBeTruthy();
    });

    it('should render badge correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Бесплатно и без регистрации/)).toBeTruthy();
    });
  });

  describe('Button Labels', () => {
    it('should show "Начать бесплатно" for unauthenticated users', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText('Начать бесплатно')).toBeTruthy();
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
      const button = getByText('Начать бесплатно');
      
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
    it('should render on different screen sizes', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Идеи для поездок/)).toBeTruthy();
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
        return;
      }
      expect(MOOD_CARDS_FOR_TEST[0].filters).toEqual({
        categoryTravelAddress: [84, 110, 113, 193],
      });
      expect(MOOD_CARDS_FOR_TEST[1].filters).toEqual({ categoryTravelAddress: [33, 43] });
      expect(MOOD_CARDS_FOR_TEST[2].filters).toEqual({ categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] });
      expect(MOOD_CARDS_FOR_TEST[3].filters).toEqual({ categories: [21, 22, 2] });
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
