import { render } from '@testing-library/react-native';

const mockRedirect = jest.fn(({ href }: { href: string }) => {
  const { Text } = require('react-native');
  return <Text testID="planned-trips-redirect">{href}</Text>;
});

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));

describe('PlannedTripsRedirect', () => {
  it('uses /trips/my as the canonical trips dashboard', () => {
    const PlannedTripsRedirect = require('@/app/(tabs)/trips/plan/index').default;
    const { getByTestId } = render(<PlannedTripsRedirect />);

    expect(getByTestId('planned-trips-redirect').props.children).toBe('/trips/my');
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/trips/my' });
  });
});
