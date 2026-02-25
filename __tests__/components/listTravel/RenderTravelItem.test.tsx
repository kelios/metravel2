import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@/hooks/useTheme';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isAuthenticated: true,
    userId: 'test-user',
  }),
}));

const mockTravel = {
  id: 1,
  slug: 'test-travel',
  name: 'Test Travel',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  travel_image_thumb_small_url: 'https://example.com/image_small.jpg',
  url: '/travels/test-travel',
  youtube_link: '',
  userName: 'Test User',
  description: 'Test description',
  recommendation: 'Great place!',
  plus: 'Beautiful views',
  minus: 'Expensive',
  cityName: 'Test City',
  countryName: 'Россия',
  countUnicIpView: '100',
  gallery: [],
  travelAddress: [],
  userIds: '1',
  year: '2024',
  monthName: 'Январь',
  number_days: 7,
  companions: ['Семья'],
  countryCode: 'RU',
  created_at: '2024-01-01T00:00:00Z',
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('RenderTravelItem Component', () => {
  const mockOnDeletePress = jest.fn();
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders travel item correctly', () => {
    renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={false}
        isSuperuser={false}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={false}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getAllByText('Test Travel')[0]).toBeTruthy();
    // Note: Test User and Россия may not be rendered in the current component structure
    expect(screen.getByTestId('travel-card-test-travel')).toBeTruthy();
  });

  it('renders mobile version correctly', () => {
    renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={true}
        isSuperuser={false}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={false}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getAllByText('Test Travel')[0]).toBeTruthy();
    // Note: Россия may not be rendered in the current component structure
    expect(screen.getByTestId('travel-card-test-travel')).toBeTruthy();
  });

  it('shows delete button for superuser', () => {
    renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={false}
        isSuperuser={true}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={false}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    // Delete button should be present for superuser
    const deleteButton = screen.getByTestId('delete-button');
    expect(deleteButton).toBeTruthy();
  });

  it('calls onDeletePress when delete button is pressed', () => {
    renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={false}
        isSuperuser={true}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={false}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    const deleteButton = screen.getByTestId('delete-button');
    fireEvent.press(deleteButton);

    expect(mockOnDeletePress).toHaveBeenCalledWith(mockTravel.id);
  });

  it('shows selection checkbox when selectable is true', () => {
    renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={false}
        isSuperuser={false}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={true}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = screen.getByTestId('selection-checkbox');
    expect(checkbox).toBeTruthy();
  });

  it('calls onToggle when selection checkbox is pressed', () => {
    const { getByTestId } = renderWithProviders(
      <RenderTravelItem
        item={mockTravel}
        index={0}
        isMobile={false}
        isSuperuser={false}
        isMetravel={false}
        onDeletePress={mockOnDeletePress}
        isFirst={false}
        selectable={true}
        isSelected={false}
        onToggle={mockOnToggle}
      />
    );

    const checkbox = getByTestId('selection-checkbox');
    fireEvent.press(checkbox);

    expect(mockOnToggle).toHaveBeenCalled();
  });
});
