/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act } from 'react-test-renderer';
import { render } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  }),
}));

// Force mobile layout via useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, width: 375 }),
}));

// Make TravelDetailsContainer deterministic: provide travel data and avoid network
jest.mock('@/hooks/useTravelDetails', () => ({
  useTravelDetails: () => ({
    travel: {
      id: 1,
      name: 'Demo',
      gallery: [],
      travelAddress: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    slug: 'demo',
    isId: false,
  }),
}));

jest.mock('@/hooks/useActiveSection', () => ({
  useActiveSection: () => ({ activeSection: 'gallery', setActiveSection: jest.fn() }),
}));

jest.mock('@/hooks/useScrollNavigation', () => ({
  useScrollNavigation: () => ({
    scrollRef: { current: null },
    anchors: {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    },
    scrollTo: jest.fn(),
  }),
}));

jest.mock('@/hooks/useMenuState', () => ({
  useMenuState: () => ({
    isMenuOpen: false,
    menuWidth: 280,
    animatedX: { interpolate: () => 0 },
    openMenu: jest.fn(),
    closeMenu: jest.fn(),
    toggleMenu: jest.fn(),
  }),
}));

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({ shouldLoad: true, setElementRef: jest.fn() }),
  ProgressiveWrapper: ({ children }: any) => children,
}));

jest.mock('@/components/SectionSkeleton', () => ({
  SectionSkeleton: () => null,
}));

jest.mock('@/components/travel/TelegramDiscussionSection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/CTASection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/ShareButtons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/QuickFacts', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/TravelSectionsSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/ReadingProgressBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/ScrollToTopButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/Slider', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/NavigationArrows', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  DescriptionSkeleton: () => null,
  MapSkeleton: () => null,
  PointListSkeleton: () => null,
  TravelListSkeleton: () => null,
}));

jest.mock('@/components/travel/NearTravelList', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/PopularTravelList', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/CompactSideBarTravel', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/WeatherWidget', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/seo/InstantSEO', () => ({
  __esModule: true,
  default: () => null,
}));

import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer';

describe('TravelDetailsContainer (mobile) no duplicated engagement blocks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders Telegram engagement block only once', () => {
    const { queryAllByTestId } = render(<TravelDetailsContainer />);

    // TravelDetails uses internal Defer (rIC + timeout up to 2600ms) before rendering heavy sections.
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(queryAllByTestId('travel-details-telegram')).toHaveLength(1);
  });
});
