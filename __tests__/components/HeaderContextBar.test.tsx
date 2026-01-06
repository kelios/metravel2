import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import HeaderContextBar from '@/components/HeaderContextBar';

jest.mock('@/stores/mapPanelStore', () => {
  const actual = jest.requireActual('@/stores/mapPanelStore');
  return {
    ...actual,
    useMapPanelStore: jest.fn(),
  };
});

jest.mock('@/hooks/useBreadcrumbModel', () => ({
  useBreadcrumbModel: jest.fn(),
}));

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1400,
      height: 900,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    },
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: jest.fn(() => ({ width: 1024, height: 768 })),
  };
});

describe('HeaderContextBar', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();
  const mockRequestToggleMapPanel = jest.fn();

  const { useBreadcrumbModel } = jest.requireMock('@/hooks/useBreadcrumbModel') as {
    useBreadcrumbModel: jest.Mock;
  };

  const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, back: mockBack });

    const { useMapPanelStore } = jest.requireMock('@/stores/mapPanelStore') as {
      useMapPanelStore: jest.Mock;
    };
    useMapPanelStore.mockImplementation((selector: any) =>
      selector({ openNonce: 0, toggleNonce: 0, requestToggle: mockRequestToggleMapPanel, requestOpen: jest.fn() })
    );

    (global as any).__mockResponsive = {
      width: 1400,
      height: 900,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    };

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: false,
      pageContextTitle: 'Путешествия',
      currentTitle: 'Путешествия',
      backToPath: null,
      items: [],
    });
  });

  it('should show page context title on home', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { getByText, queryByText } = renderWithClient(<HeaderContextBar />);
    expect(getByText('Путешествия')).toBeTruthy();
    expect(queryByText('Главная')).toBeNull();
  });

  it('should show page context title on top-level routes', () => {
    (usePathname as jest.Mock).mockReturnValue('/map');

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: false,
      pageContextTitle: 'Карта',
      currentTitle: 'Карта',
      backToPath: null,
      items: [],
    });

    const { getByText, queryByText } = renderWithClient(<HeaderContextBar />);
    expect(getByText('Карта')).toBeTruthy();
    expect(queryByText('Главная')).toBeNull();
  });

  it('should render breadcrumb chain on nested routes and navigate on click', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: true,
      pageContextTitle: 'Путешествия',
      currentTitle: 'Mock Travel',
      backToPath: null,
      items: [{ path: '/travels/test-slug', label: 'Mock Travel' }],
    });

    const { getByText } = renderWithClient(<HeaderContextBar />);

    const homeCrumb = getByText('Главная');
    expect(homeCrumb).toBeTruthy();
    expect(getByText('Mock Travel')).toBeTruthy();

    fireEvent.press(homeCrumb);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should show map panel open button on mobile /map', () => {
    (usePathname as jest.Mock).mockReturnValue('/map');
    (global as any).__mockResponsive = {
      width: 390,
      height: 844,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: false,
      pageContextTitle: 'Карта',
      currentTitle: 'Карта',
      backToPath: null,
      items: [],
    });

    const { getByTestId, queryByTestId } = renderWithClient(<HeaderContextBar />);
    expect(getByTestId('map-panel-open')).toBeTruthy();
    expect(queryByTestId('mobile-sections-open')).toBeNull();

    fireEvent.press(getByTestId('map-panel-open'));
    expect(mockRequestToggleMapPanel).toHaveBeenCalled();
  });

  it('should not render sections menu button on mobile non-travel pages', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    (global as any).__mockResponsive = {
      width: 390,
      height: 844,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: false,
      pageContextTitle: 'Путешествия',
      currentTitle: 'Путешествия',
      backToPath: null,
      items: [],
    });

    const { queryByTestId } = renderWithClient(<HeaderContextBar />);
    expect(queryByTestId('map-panel-open')).toBeNull();
    expect(queryByTestId('mobile-sections-open')).toBeNull();
  });

  it('should render sections menu button on mobile travel details pages', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
    (global as any).__mockResponsive = {
      width: 390,
      height: 844,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    useBreadcrumbModel.mockReturnValue({
      showBreadcrumbs: false,
      pageContextTitle: 'Mock Travel',
      currentTitle: 'Mock Travel',
      backToPath: null,
      items: [],
    });

    const { getByTestId } = renderWithClient(<HeaderContextBar />);
    expect(getByTestId('mobile-sections-open')).toBeTruthy();
  });
});
