import { render } from '@testing-library/react-native';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));

describe('PlannedTripsRedirect', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('uses /trips/my as the canonical trips dashboard', async () => {
    const PlannedTripsRedirect = require('@/app/(tabs)/trips/plan/index').default;
    const { toJSON } = await render(<PlannedTripsRedirect />);

    expect(toJSON()).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/trips/my' });
  });
});
