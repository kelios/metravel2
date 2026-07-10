import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, View } from 'react-native';

import type { PublicTrip } from '@/api/publicTrips';

const mockUsePublicTrip = jest.fn();
const mockUseMyTripApplications = jest.fn();
const mockImageCardMedia = jest.fn((_props: Record<string, unknown>) => (
  <View testID="mock-image-card-media" />
));
const mockUnifiedTravelCard = jest.fn((_props: Record<string, unknown>) => (
  <View testID="mock-unified-travel-card" />
));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: (_target, key) => String(key) }),
}));

jest.mock('@/hooks/usePublicTripsApi', () => ({
  usePublicTrip: (...args: unknown[]) => mockUsePublicTrip(...args),
  useMyTripApplications: (...args: unknown[]) => mockUseMyTripApplications(...args),
}));

jest.mock('@/hooks/useActionConsent', () => ({
  useActionConsent: () => ({ hydrated: true, granted: false, grant: jest.fn() }),
}));

jest.mock('@/utils/actionConsent', () => ({
  CONSENT_TYPES: { CONTACT_EXCHANGE: 'contact-exchange' },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

jest.mock('@/utils/tripAnalytics', () => ({
  trackFeaturedClick: jest.fn(),
  trackFeaturedImpression: jest.fn(),
  trackTripViewed: jest.fn(),
}));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockImageCardMedia(props),
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockUnifiedTravelCard(props),
}));

import PublicTripCard from '@/components/trips/PublicTripCard';
import PublicTripDetail from '@/components/trips/PublicTripDetail';

const baseTrip: PublicTrip = {
  id: 1,
  slug: '1',
  title: 'Поездка без обложки',
  coverUrl: null,
  region: 'Минск',
  tripType: 'car',
  startDate: '2026-08-15T09:00:00Z',
  endDate: null,
  organizer: { id: 5, name: 'Юлия', avatarUrl: null },
  seatsTotal: 4,
  seatsTaken: 1,
  status: 'open',
  description: 'Описание',
  featured: false,
  myApplicationStatus: null,
  isOwner: false,
  meetingPoint: null,
  contactNote: null,
};

describe('public trip fallback cover', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
    mockUsePublicTrip.mockReset();
    mockUseMyTripApplications.mockReset();
    mockUseMyTripApplications.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockImageCardMedia.mockClear();
    mockUnifiedTravelCard.mockClear();
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('uses a default cover on the public trip detail when coverUrl is empty', () => {
    mockUsePublicTrip.mockReturnValue({ data: baseTrip, isLoading: false, isError: false });

    render(<PublicTripDetail tripId={1} />);

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      src: '/trips/fallbacks/trip-fallback-summer.jpg',
      optimizeWeb: false,
      placeholderSrc: '/trips/fallbacks/trip-fallback-summer.jpg',
      showImmediately: true,
      showLoadingIndicator: false,
      testID: 'trip-detail-cover',
    });
  });

  it('uses a default cover on public trip cards when coverUrl is empty', () => {
    render(<PublicTripCard trip={baseTrip} onPress={jest.fn()} />);

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      imageUrl: '/trips/fallbacks/trip-fallback-summer.jpg',
      mediaProps: {
        optimizeWeb: false,
        placeholderSrc: '/trips/fallbacks/trip-fallback-summer.jpg',
        recyclingKey: 'trip-fallback-summer-1',
        showImmediately: true,
        showLoadingIndicator: false,
      },
    });
  });
});
