import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { PlannedTrip } from '@/api/plannedTrips';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_target, key) => String(key) }) as unknown as Record<string, string>,
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => {
  const { View } = require('react-native');
  return function MockUnifiedTravelCard({ contentSlot }: { contentSlot: ReactNode }) {
    return <View>{contentSlot}</View>;
  };
});

jest.mock('@/components/ui/ActionListSheet', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockActionListSheet({
    visible,
    actions,
  }: {
    visible: boolean;
    actions: Array<{ key: string; label: string; onPress: () => void }>;
  }) {
    if (!visible) return null;
    return (
      <View testID="trip-card-action-sheet">
        {actions.map((action) => (
          <Pressable key={action.key} testID={`trip-card-action-${action.key}`} onPress={action.onPress}>
            <Text>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});

jest.mock('@/components/trips/planning/tripFallbackCover', () => ({
  getTripFallbackCover: () => ({ uri: 'fallback.png', key: 'fallback' }),
}));

const trip: PlannedTrip = {
  id: 1,
  slug: 'trip-1',
  title: 'Поездка организатора',
  description: '',
  startDate: '2026-08-01',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 1,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: 'Минск',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-11T10:00:00Z',
};

describe('TripPlanCard organizer actions', () => {
  it('counts the organizer when the list response omits them from participants', () => {
    const { getByText } = render(<TripPlanCard trip={trip} />);

    expect(getByText('Едут 1 из 1')).toBeTruthy();
    expect(getByText('· 1 в списке')).toBeTruthy();
  });

  it('keeps edit and delete in the secondary actions sheet', () => {
    const onEditPress = jest.fn();
    const onDeletePress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TripPlanCard trip={trip} onEditPress={onEditPress} onDeletePress={onDeletePress} />,
    );

    expect(queryByTestId('trip-card-action-sheet')).toBeNull();
    fireEvent.press(getByTestId('trip-plan-card-more-1'));
    expect(getByTestId('trip-card-action-sheet')).toBeTruthy();

    fireEvent.press(getByTestId('trip-card-action-edit'));
    expect(onEditPress).toHaveBeenCalledWith(trip);
    expect(onDeletePress).not.toHaveBeenCalled();
  });
});
