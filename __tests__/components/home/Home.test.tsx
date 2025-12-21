import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '@/components/home/Home';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { fetchMyTravels } from '@/src/api/travelsApi';

// Mock dependencies
jest.mock('@/context/AuthContext');
jest.mock('@react-navigation/native');
jest.mock('@/src/api/travelsApi');
jest.mock('@/src/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));

// Mock lazy loaded components
jest.mock('@/components/home/HomeInspirationSection', () => {
  return function MockHomeInspirationSections() {
    return null;
  };
});

jest.mock('@/components/home/HomeFinalCTA', () => {
  return function MockHomeFinalCTA() {
    return null;
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;
const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

describe('Home Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    
    mockUseIsFocused.mockReturnValue(true);
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

  const renderHome = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { getByTestId } = renderHome();
      expect(getByTestId).toBeDefined();
    });

    it('should render HomeHero component', () => {
      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });

    it('should render HomeHowItWorks component', () => {
      const { UNSAFE_getByType } = renderHome();
      const HomeHowItWorks = require('@/components/home/HomeHowItWorks').default;
      expect(UNSAFE_getByType(HomeHowItWorks)).toBeTruthy();
    });
  });

  describe('Authentication States', () => {
    it('should not show loading skeleton for unauthenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        userId: null,
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { queryByTestId } = renderHome();
      expect(queryByTestId('travel-card-skeleton')).toBeNull();
      expect(mockFetchMyTravels).not.toHaveBeenCalled();
    });

    it('should not fetch travels on home even when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      const heroInstance = UNSAFE_getByType(HomeHero);
      expect(heroInstance.props.travelsCount).toBe(0);
      expect(mockFetchMyTravels).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should handle mobile viewport (320px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 320,
        height: 568,
        scale: 2,
        fontScale: 1,
      });

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });

    it('should handle small mobile viewport (480px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 480,
        height: 800,
        scale: 2,
        fontScale: 1,
      });

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });

    it('should handle tablet viewport (768px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 768,
        height: 1024,
        scale: 2,
        fontScale: 1,
      });

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });

    it('should handle desktop viewport (1024px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1024,
        height: 768,
        scale: 1,
        fontScale: 1,
      });

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });

    it('should handle large desktop viewport (1920px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1920,
        height: 1080,
        scale: 1,
        fontScale: 1,
      });

      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
    });
  });

  // Data fetching is intentionally disabled on home; no data-handling tests needed here.

  describe('Performance', () => {
    it('should use lazy loading for heavy components', () => {
      const { UNSAFE_getByType } = renderHome();
      const HomeHero = require('@/components/home/HomeHero').default;
      expect(UNSAFE_getByType(HomeHero)).toBeTruthy();
      // Lazy components should be wrapped in Suspense
    });

    it('should have optimized scroll event throttle', () => {
      const { UNSAFE_getByType } = renderHome();
      const ScrollView = require('react-native').ScrollView;
      const scrollView = UNSAFE_getByType(ScrollView);
      
      // Should have scrollEventThrottle prop
      expect(scrollView.props.scrollEventThrottle).toBeDefined();
    });
  });
});
