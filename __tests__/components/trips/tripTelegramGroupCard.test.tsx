import { render } from '@testing-library/react-native';

import TripTelegramGroupCard from '@/components/trips/communication/TripTelegramGroupCard';

const mockUseTripTelegramGroup = jest.fn();
const mockCreateMutate = jest.fn();
const mockInviteMutate = jest.fn();

jest.mock('@/hooks/useTripTelegramGroupApi', () => ({
  useTripTelegramGroup: (...args: unknown[]) => mockUseTripTelegramGroup(...args),
  useCreateTripTelegramGroup: () => ({ mutate: mockCreateMutate, isPending: false }),
  useFetchTripInviteLink: () => ({ mutate: mockInviteMutate, isPending: false }),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    border: 'gray',
    danger: 'red',
    primaryDark: 'darkslategray',
    surface: 'white',
    text: 'black',
    textOnPrimary: 'white',
    textSecondary: 'dimgray',
  }),
}));

describe('TripTelegramGroupCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a disabled explanation instead of owner-create when the query failed', () => {
    mockUseTripTelegramGroup.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const { getByTestId, getByText, queryByTestId } = render(
      <TripTelegramGroupCard tripId={42} isOwner />,
    );

    expect(getByTestId('trip-telegram-unavailable')).toBeTruthy();
    expect(getByTestId('trip-telegram-disabled').props.accessibilityState.disabled).toBe(true);
    expect(getByText(/Telegram-группы поездок пока не подключены/)).toBeTruthy();
    expect(queryByTestId('trip-telegram-create')).toBeNull();
  });
});
