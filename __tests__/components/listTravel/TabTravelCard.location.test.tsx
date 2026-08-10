import { render } from '@testing-library/react-native';
import TabTravelCard from '@/components/listTravel/TabTravelCard';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
  }),
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID={props.testID || 'unified-travel-card'}>{props.contentSlot}</View>;
  },
}));

const renderCard = (item: { city: string | null; country: string | null }) =>
  render(
    <TabTravelCard
      item={{ id: '485', title: 'Будапешт за три дня', imageUrl: null, ...item } as any}
      testID="card"
    />,
  );

describe('TabTravelCard location line', () => {
  it('shows the country instead of the geocoded address stored in city', () => {
    // Реальное значение cityName у travel 485 на проде. Строка рендерится с
    // numberOfLines={1}, поэтому раньше карточка показывала обрезанный адрес.
    const { queryByText } = renderCard({
      city: 'Базилика Святого Стефана, 1, Szent István tér, Lipótváros, 5th district, Будапешт, Центральная Венгрия, 1051, Венгрия',
      country: 'Венгрия',
    });

    expect(queryByText('Венгрия')).toBeTruthy();
    expect(queryByText(/Szent István tér/)).toBeNull();
  });

  it('keeps a real city name next to the country', () => {
    const { queryByText } = renderCard({ city: 'Краков', country: 'Польша' });
    expect(queryByText('Краков, Польша')).toBeTruthy();
  });

  it('renders no dangling separator when neither city nor country is usable', () => {
    const { queryByText } = renderCard({
      city: 'Rezerwat Lipowska, Kamienna, Żabnica, Живецкий повят, Польша',
      country: null,
    });
    expect(queryByText(/Rezerwat Lipowska/)).toBeNull();
    expect(queryByText(/,/)).toBeNull();
  });
});
