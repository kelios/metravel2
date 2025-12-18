import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import HeaderContextBar from '@/components/HeaderContextBar';

jest.mock('@/hooks/useBreadcrumbModel', () => ({
  useBreadcrumbModel: jest.fn(),
}));

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
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
});
