import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/types/types';

const mockUnifiedTravelCard = jest.fn<any, [any]>(() => null);

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}));

jest.mock('expo-router', () => {
  const push = jest.fn();
  return {
    router: { push },
    useRouter: () => ({ push }),
  };
});

jest.mock('@/components/travel/FavoriteButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'web',
  select: jest.fn((obj) => obj.web || obj.default),
}));

const baseTravel: Travel = {
  id: 1,
  name: 'Test travel',
  slug: 'test-travel',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  url: '/travels/test-travel',
  userName: 'Author',
  userIds: '42',
  countryName: 'Беларусь',
  countUnicIpView: '12',
  gallery: [],
  travelAddress: [],
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as any;

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderItem = (props: Partial<React.ComponentProps<typeof TravelListItem>> = {}) => {
  const queryClient = createTestClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FavoritesProvider>
          <TravelListItem
            travel={baseTravel}
            currentUserId={null}
            isSuperuser={false}
            isMetravel={false}
            isMobile={false}
            {...props}
          />
        </FavoritesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('TravelListItem media props on web', () => {
  const originalUserAgent = window.navigator.userAgent;
  const originalMaxTouchPoints = window.navigator.maxTouchPoints;

  beforeEach(() => {
    mockUnifiedTravelCard.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
  });

  it('keeps blur background enabled for default list cards', () => {
    renderItem();

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.blurBackground).toBe(true);
  });

  it('renders default list cards without inset media shell gaps', () => {
    renderItem();

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.insetMedia).toBe(false);
  });

  it('keeps the first mobile web card hidden until onLoad only on iPhone Safari', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });

    renderItem({ isFirst: true, isMobile: true });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.revealOnLoadOnly).toBe(true);
  });

  it('keeps non-Safari or non-first cards on the existing path', () => {
    renderItem({ isFirst: true, isMobile: true });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.revealOnLoadOnly).toBe(false);
  });
});
