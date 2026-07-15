import { render } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('PlannedTripsRedirect', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('uses /trips/my as the canonical trips dashboard', () => {
    const PlannedTripsRedirect = require('@/app/(tabs)/trips/plan/index').default;
    const { toJSON } = render(<PlannedTripsRedirect />);

    expect(toJSON()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/trips/my');
  });
});
