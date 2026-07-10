import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import MyCreatedTripsList from '@/components/trips/MyCreatedTripsList';
import type { PlannedTrip } from '@/api/plannedTrips';
import { confirmAction } from '@/utils/confirmAction';

const mockPush = jest.fn();
const mockUseMyPlannedTrips = jest.fn();
const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_target, key) => String(key) }) as unknown as Record<string, string>,
}));

jest.mock('@/components/trips/planning/TripPlanCard', () => {
  const { Pressable, Text, View } = require('react-native');

  return function MockTripPlanCard({
    trip,
    onOpenPress,
    onEditPress,
    onDeletePress,
  }: {
    trip: PlannedTrip;
    onOpenPress?: (trip: PlannedTrip) => void;
    onEditPress?: (trip: PlannedTrip) => void;
    onDeletePress?: (trip: PlannedTrip) => void;
  }) {
    return (
      <Pressable testID={`mock-trip-card-${trip.id}`} onPress={() => onOpenPress?.(trip)}>
        <Text>{trip.title}</Text>
        <View>
          <Pressable testID={`my-created-trip-edit-${trip.id}`} onPress={() => onEditPress?.(trip)}>
            <Text>edit</Text>
          </Pressable>
          <Pressable testID={`my-created-trip-delete-${trip.id}`} onPress={() => onDeletePress?.(trip)}>
            <Text>delete</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };
});

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useMyPlannedTrips: () => mockUseMyPlannedTrips(),
  useDeletePlannedTrip: () => ({
    mutate: mockMutate,
    isPending: false,
    variables: undefined,
  }),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

jest.mock('@/utils/toast', () => ({
  showToastMessage: jest.fn(),
}));

const makeTrip = (overrides: Partial<PlannedTrip>): PlannedTrip => ({
  id: 1,
  slug: 'trip-1',
  title: 'Организуемая поездка',
  description: 'Описание',
  startDate: '2026-08-01',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Юля', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: 'Беларусь',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-09T10:00:00Z',
  ...overrides,
});

describe('MyCreatedTripsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMyPlannedTrips.mockReturnValue({
      data: [
        makeTrip({ id: 1, title: 'Организуемая поездка', isOwner: true }),
        makeTrip({ id: 2, title: 'Чужая поездка', isOwner: false }),
      ],
      isLoading: false,
      isError: false,
    });
  });

  it('shows only trips organized by the current user and opens a trip', () => {
    const { getByText, queryByText, getByTestId } = render(<MyCreatedTripsList />);

    expect(getByText('Организуемая поездка')).toBeTruthy();
    expect(queryByText('Чужая поездка')).toBeNull();

    fireEvent.press(getByTestId('mock-trip-card-1'));

    expect(mockPush).toHaveBeenCalledWith('/trips/plan/1');
  });

  it('opens an organized trip in edit mode from the compact card action', () => {
    const { getByTestId } = render(<MyCreatedTripsList />);

    fireEvent.press(getByTestId('my-created-trip-edit-1'));

    expect(mockPush).toHaveBeenCalledWith('/trips/plan/1?edit=1');
  });

  it('confirms and deletes an organized trip from the list', async () => {
    (confirmAction as jest.Mock).mockResolvedValueOnce(true);

    const { getByTestId } = render(<MyCreatedTripsList />);

    fireEvent.press(getByTestId('my-created-trip-delete-1'));

    await waitFor(() => {
      expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Удалить поездку',
        confirmText: 'Удалить',
      }));
      expect(mockMutate).toHaveBeenCalledWith(1, expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }));
    });
  });
});
