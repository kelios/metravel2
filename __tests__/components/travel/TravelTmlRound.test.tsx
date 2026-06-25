import { render } from '@testing-library/react-native';
import { View } from 'react-native';

import TravelTmlRound from '@/components/travel/TravelTmlRound';

const mockUnifiedTravelCard = jest.fn((props: any) => (
  <View testID="unified-travel-card">
    {props.containerOverlaySlot}
    {props.contentSlot}
  </View>
));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    backgroundSecondary: '#f4f4f5',
    borderLight: '#e4e4e7',
    overlay: 'rgba(0,0,0,0.72)',
    surface: '#ffffff',
    text: '#111827',
    textMuted: '#6b7280',
    textOnDark: '#ffffff',
  }),
}));

jest.mock('@/utils/imageOptimization', () => ({
  buildVersionedImageUrl: (url: string) => url,
  getOptimalImageSize: (width: number, height: number) => ({ width, height }),
  optimizeImageUrl: (url: string) => url,
}));

jest.mock('@/utils/shareTravel', () => ({
  shareTravel: jest.fn(),
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const { Text } = require('react-native');

  return function MockFeather({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
});

describe('TravelTmlRound', () => {
  beforeEach(() => {
    mockUnifiedTravelCard.mockClear();
  });

  it('renders compact popular-card metadata: author, year and views', () => {
    const { getByText } = render(
      <TravelTmlRound
        travel={{
          id: 42,
          slug: 'popular-route',
          name: 'Популярный маршрут',
          countryName: 'Беларусь',
          userName: 'Анна Иванова',
          year: '2024',
          countUnicIpView: '2400',
        } as any}
      />,
    );

    expect(getByText('Беларусь')).toBeTruthy();
    expect(getByText('Анна Иванова')).toBeTruthy();
    expect(getByText('2024')).toBeTruthy();
    expect(getByText('2.4K')).toBeTruthy();
  });
});
