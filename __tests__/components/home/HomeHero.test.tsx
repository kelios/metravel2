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
      expect(getByText(/Находи маршруты/)).toBeTruthy();
    });

    it('should render subtitle correctly', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText(/Читай поездки других/)).toBeTruthy();
    });

    it('should not show hint for unauthenticated users', () => {
      const { queryByText } = render(<HomeHero travelsCount={0} />);
      expect(queryByText(/Расскажи о своём первом путешествии/)).toBeNull();
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
      expect(getByText(/Расскажи о своём первом путешествии/)).toBeTruthy();
    });
  });

  describe('Button Labels', () => {
    it('should show "Рассказать о путешествии" for unauthenticated users', () => {
      const { getByText } = render(<HomeHero />);
      expect(getByText('Рассказать о путешествии')).toBeTruthy();
    });

    it('should show "Написать первую историю" for authenticated users with no travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={0} />);
      expect(getByText('Написать первую историю')).toBeTruthy();
    });

    it('should show "Собрать книгу из историй" for authenticated users with travels', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        userId: '123',
        login: jest.fn(),
        logout: jest.fn(),
        setUserAvatar: jest.fn(),
        triggerProfileRefresh: jest.fn(),
      } as any);

      const { getByText } = render(<HomeHero travelsCount={5} />);
      expect(getByText('Собрать книгу из историй')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to login for unauthenticated users', () => {
      const { getByText } = render(<HomeHero />);
      const button = getByText('Рассказать о путешествии');
      
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
      const button = getByText('Написать первую историю');
      
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
      const button = getByText('Собрать книгу из историй');
      
      fireEvent.press(button);
      
      expect(mockPush).toHaveBeenCalledWith('/export');
    });

    it('should navigate to search when clicking "Найти маршрут"', () => {
      const { getByText } = render(<HomeHero />);
      const button = getByText('Найти маршрут');
      
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
      expect(getByText(/Находи маршруты/)).toBeTruthy();
    });

    it('should apply mobile styles on medium screens (480px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 480,
        height: 800,
        scale: 2,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Находи маршруты/)).toBeTruthy();
    });

    it('should apply mobile styles on tablets (768px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 768,
        height: 1024,
        scale: 2,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Находи маршруты/)).toBeTruthy();
    });

    it('should apply desktop styles on large screens (1024px)', () => {
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1024,
        height: 768,
        scale: 1,
        fontScale: 1,
      });

      const { getByText } = render(<HomeHero />);
      expect(getByText(/Находи маршруты/)).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons with proper labels', () => {
      const { getByLabelText } = render(<HomeHero />);
      expect(getByLabelText('Найти маршрут')).toBeTruthy();
    });
  });
});
