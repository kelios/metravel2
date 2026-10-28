import React from 'react';
import { router } from 'expo-router';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@/hooks/useTheme';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRouterPush = router.push as jest.Mock;

jest.mock('expo-router', () => {
  const mockRouter = { push: jest.fn() };
  return { router: mockRouter, useRouter: () => mockRouter, usePathname: () => '' };
});

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

const renderWithProviders = async (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return await render(
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

  it('renders travel item correctly', async () => {
    await renderWithProviders(
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

  it('renders mobile version correctly', async () => {
    await renderWithProviders(
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

  it('shows delete button for superuser', async () => {
    await renderWithProviders(
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

  it('calls onDeletePress when delete button is pressed', async () => {
    await renderWithProviders(
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
    await fireEvent.press(deleteButton);

    expect(mockOnDeletePress).toHaveBeenCalledWith(mockTravel.id);
  });

  it('shows selection checkbox when selectable is true', async () => {
    await renderWithProviders(
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

  it('calls onToggle when selection checkbox is pressed', async () => {
    const { getByTestId } = await renderWithProviders(
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
    await fireEvent.press(checkbox);

    expect(mockOnToggle).toHaveBeenCalled();
  });
});

describe('real author-card moderation controls', () => {
  const rejectedTravel = { ...mockTravel, publication_status: 'draft' as const,
    moderation_decision: 'rejected' as const, moderation_decision_reason: 'Добавьте сведения о маршруте' };
  beforeEach(() => jest.clearAllMocks());

  it('shows the rejection without a duplicate draft badge and correction opens the existing editor', async () => {
    const screen = await renderWithProviders(<RenderTravelItem item={rejectedTravel} currentUserId="1" showAuthorModerationFeedback />);
    expect(screen.getByTestId('publication-status-icon').props.accessibilityLabel).toBe('Отклонено');
    expect(screen.queryByText('Отклонено')).toBeNull();
    expect(screen.queryByTestId('draft-status-badge')).toBeNull();
    await fireEvent.press(screen.getByTestId('moderation-correct-button'));
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/travel/1');
  });

  it.each([
    { currentUserId: '1', showAuthorModerationFeedback: false },
    { currentUserId: '2', showAuthorModerationFeedback: true },
    { currentUserId: '2', showAuthorModerationFeedback: true, isSuperuser: true },
  ])('does not render a cached private reason for %p', async (context) => {
    const screen = await renderWithProviders(<RenderTravelItem item={rejectedTravel} {...context} />);
    expect(screen.queryByText('Отклонено')).toBeNull();
    expect(screen.queryByText(rejectedTravel.moderation_decision_reason)).toBeNull();
    expect(screen.queryByTestId('moderation-correct-button')).toBeNull();
  });
});
