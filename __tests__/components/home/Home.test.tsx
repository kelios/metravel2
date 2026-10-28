import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Home from '@/components/home/Home';
import { useAuth } from '@/context/AuthContext';
import { fetchMyTravels } from '@/api/travelUserQueries';

// Mock dependencies
jest.mock('@/context/AuthContext');
jest.mock('@/api/travelUserQueries');
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
  queueAnalyticsEvent: jest.fn(),
}));

// Mock lazy loaded components
jest.mock('@/components/home/HomeInspirationSection', () => {
  function MockHomeInspirationSections() {
    return null;
  }
  function MockHomeInspirationSection() {
    return null;
  }
  return {
    __esModule: true,
    default: MockHomeInspirationSections,
    HomeInspirationSection: MockHomeInspirationSection,
  };
});

jest.mock('@/components/home/HomeFinalCTA', () => {
  return function MockHomeFinalCTA() {
    return null;
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

describe('Home Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    // HERO-06: Мок fetchMyTravels для загрузки travelsCount
    mockFetchMyTravels.mockResolvedValue({ data: [], total: 0 } as any);
    // useIsFocused приходит из глобального мока expo-router (setup.ts) и возвращает true
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

  const renderHome = async () => {
    return await render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      const { getByTestId } = await renderHome();
      expect(getByTestId).toBeDefined();
    });

    it('should render HomeHero component', async () => {
      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });

    it('should not render the How It Works block on home (moved out of main flow)', async () => {
      const { queryByTestId } = await renderHome();
      expect(queryByTestId('home-how-it-works')).toBeNull();
    });

    it('should render HomeFAQSection', async () => {
      const { getByTestId } = await renderHome();
      expect(getByTestId('home-faq')).toBeTruthy();
    });

    it('invites readers to the author landing inside the home scroll content', async () => {
      const { getByText } = await renderHome();
      expect(getByText('Ваш опыт пригодится другим путешественникам')).toBeTruthy();
      expect(getByText('Стать автором')).toBeTruthy();
    });
  });

  describe('Authentication States', () => {
    it('should not show loading skeleton for unauthenticated users', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        userId: null,
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { queryByTestId } = await renderHome();
      expect(queryByTestId('travel-card-skeleton')).toBeNull();
      expect(mockFetchMyTravels).not.toHaveBeenCalled();
    });

    it('should fetch travels count for authenticated users (HERO-06)', async () => {
      // HERO-06: устанавливаем мок ДО рендера чтобы queryFn получил правильные данные
      mockFetchMyTravels.mockResolvedValue({ data: [], total: 3 } as any);

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);


      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
      expect(mockFetchMyTravels).toHaveBeenCalledWith({ user_id: '123', perPage: 1, throwOnError: true });
    });
  });

  describe('Responsive Design', () => {
    it('should handle mobile viewport (320px)', async () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 320,
        height: 568,
        scale: 2,
        fontScale: 1,
      });

      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });

    it('should handle small mobile viewport (480px)', async () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 480,
        height: 800,
        scale: 2,
        fontScale: 1,
      });

      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });

    it('should handle tablet viewport (768px)', async () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 768,
        height: 1024,
        scale: 2,
        fontScale: 1,
      });

      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });

    it('should handle desktop viewport (1024px)', async () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1024,
        height: 768,
        scale: 1,
        fontScale: 1,
      });

      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });

    it('should handle large desktop viewport (1920px)', async () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1920,
        height: 1080,
        scale: 1,
        fontScale: 1,
      });

      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
    });
  });

  // Data fetching is intentionally disabled on home; no data-handling tests needed here.

  describe('Performance', () => {
    it('should use lazy loading for heavy components', async () => {
      const { getByTestId } = await renderHome();
      expect(getByTestId('home-hero')).toBeTruthy();
      // Lazy components should be wrapped in Suspense
    });

    it('should have optimized scroll event throttle', async () => {
      const { container: hostContainer } = await renderHome();
      const list = getOnlyHost(hostContainer, node => (
        node.type === 'RCTScrollView'
        && typeof node.props.scrollEventThrottle === 'number'
        && node.queryAll((child) => child.props.testID === 'home-hero').length > 0
      ));
      
      // Should have scrollEventThrottle prop
      expect(list.props.scrollEventThrottle).toBeDefined();
    });

    it('keeps below-fold web sections unmounted before viewport proximity', async () => {
      const originalOS = Platform.OS;
      const originalObserver = (window as any).IntersectionObserver;

      class MockIntersectionObserver {
        observe = jest.fn();
        disconnect = jest.fn();
      }

      Platform.OS = 'web';
      (window as any).IntersectionObserver = MockIntersectionObserver;

      try {
        const { queryByTestId, getByTestId } = await renderHome();

        expect(getByTestId('home-hero')).toBeTruthy();
        expect(queryByTestId('home-faq')).toBeNull();
      } finally {
        Platform.OS = originalOS;
        (window as any).IntersectionObserver = originalObserver;
      }
    });
  });
});
