import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import { formatTripDateTime } from '@/components/trips/planning/tripPlanFormatting';

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

// #1313: контроль на реальном компоненте — сырой ISO не должен доезжать до экрана
// ни через дату старта, ни через нечитаемое значение.
describe('TripPlanCard start date rendering', () => {
  const renderedText = (node: ReturnType<typeof render>): string =>
    JSON.stringify(node.toJSON());

  it('renders a local date and time instead of the raw ISO value', () => {
    const iso = '2026-10-12T09:00:00+00:00';
    const text = renderedText(
      render(<TripPlanCard trip={{ ...trip, startDate: iso, startTime: null }} />),
    );

    expect(text).not.toContain(iso);
    expect(text).not.toMatch(/T\d{2}:\d{2}/);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // Конкретный час зависит от зоны прогона; проверяем локализованную форму.
    expect(text).toMatch(/\d{1,2} \S+ 2026 г\.,\s?\d{2}:\d{2}/);
  });

  it('renders the unavailable placeholder for an unreadable value', () => {
    const text = renderedText(
      render(<TripPlanCard trip={{ ...trip, startDate: 'not-a-date', startTime: null }} />),
    );

    expect(text).not.toContain('not-a-date');
    expect(text).toContain('Дата не указана');
  });
});

// #1314: строка участников собиралась из переводных фрагментов («Едут » + счёт +
// « из ») и печаталась с двойным пробелом. Проверяем сырой вывод: getByText
// нормализует пробелы и такой дефект пропускает.
describe('TripPlanCard participants line', () => {
  const going = (count: number): PlannedTrip => ({
    ...trip,
    seatsTotal: 4,
    isOwner: false,
    participants: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: `Участник ${index + 1}`,
      avatarUrl: null,
      rsvp: 'going' as const,
      role: 'participant' as const,
    })),
  });

  it.each([
    [1, 'Едет 1 из 4'],
    [2, 'Едут 2 из 4'],
    [5, 'Едут 5 из 4'],
  ])('uses the locale plural form for %i going', (count, expected) => {
    const text = JSON.stringify(render(<TripPlanCard trip={going(count)} />).toJSON());
    expect(text).toContain(expected);
  });

  it('renders each label as one string instead of glued fragments', () => {
    const { getByText } = render(<TripPlanCard trip={going(2)} />);

    // Один цельный дочерний узел: склейка фрагментов дала бы массив с краевыми
    // пробелами, а getByText нормализует их и дефект не поймал бы.
    expect(getByText('Едут 2 из 4').props.children).toBe('Едут 2 из 4');
    expect(getByText('· 2 в списке').props.children).toBe('· 2 в списке');
  });

  // #1342: подпись живёт в `flexDirection: 'row'`; Yoga на Android меряет её по
  // intrinsic-ширине и обрезает системным ellipsis («· 2 в списке» → «· 2 в»),
  // вместо того чтобы перенести. Нужен именно `flex: 1`: одного `flexShrink` мало,
  // потому что при `flexBasis: 'auto'` текст успевает свёрстаться в одну строку до
  // сжатия бокса — проверено на устройстве. Ловим сам стиль: отрисовка в
  // jsdom-хосте усечение не воспроизводит.
  it('measures the participants hint against the available row width', () => {
    const { getByText } = render(<TripPlanCard trip={going(2)} />);

    const style = StyleSheet.flatten(getByText('· 2 в списке').props.style);

    expect(style.flex).toBe(1);
    expect(style.width).toBeUndefined();
  });
});

describe('TripPlanCard metadata row sizing', () => {
  it('renders metadata through one flexible label without ellipsis', () => {
    const { getByText } = render(<TripPlanCard trip={trip} />);

    const metadata = getByText(
      `На машине · ${formatTripDateTime(trip.startDate, trip.startTime)}`,
    );

    expect(StyleSheet.flatten(metadata.props.style).flex).toBe(1);
    expect(metadata.props.children).toBe(
      `На машине · ${formatTripDateTime(trip.startDate, trip.startTime)}`,
    );
    expect(metadata.props.numberOfLines).toBeUndefined();
  });
});

describe('TripPlanCard organizer actions', () => {
  it('counts the organizer when the list response omits them from participants', () => {
    const { getByText } = render(<TripPlanCard trip={trip} />);

    expect(getByText('Едет 1 из 1')).toBeTruthy();
    expect(getByText('· 1 в списке')).toBeTruthy();
  });

  it('exposes edit and delete as explicit icon buttons in the action row', () => {
    const onEditPress = jest.fn();
    const onDeletePress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TripPlanCard trip={trip} onEditPress={onEditPress} onDeletePress={onDeletePress} />,
    );

    expect(queryByTestId('trip-plan-card-more-1')).toBeNull();

    fireEvent.press(getByTestId('trip-plan-card-edit-1'));
    expect(onEditPress).toHaveBeenCalledWith(trip);
    expect(onDeletePress).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('trip-plan-card-delete-1'));
    expect(onDeletePress).toHaveBeenCalledWith(trip);
  });

  // #1660: строка действий отдала 52dp двум значкам владельца, поэтому подпись
  // основной кнопки обязана сжиматься, а не выезжать за её пределы.
  it('lets the primary label shrink next to the owner icon buttons', () => {
    const { getByText } = render(
      <TripPlanCard trip={trip} onEditPress={jest.fn()} onDeletePress={jest.fn()} />,
    );

    const manageLabel = getByText('Управлять поездкой');

    expect(StyleSheet.flatten(manageLabel.props.style).flexShrink).toBe(1);
    expect(manageLabel.props.numberOfLines).toBe(1);
  });

  it('keeps the delete icon busy and locked while the trip is being removed', () => {
    const onEditPress = jest.fn();
    const onDeletePress = jest.fn();
    const { getByTestId } = render(
      <TripPlanCard trip={trip} onEditPress={onEditPress} onDeletePress={onDeletePress} isDeleting />,
    );

    const deleteButton = getByTestId('trip-plan-card-delete-1');
    expect(deleteButton.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );

    fireEvent.press(deleteButton);
    fireEvent.press(getByTestId('trip-plan-card-edit-1'));
    expect(onDeletePress).not.toHaveBeenCalled();
    expect(onEditPress).not.toHaveBeenCalled();
  });

  it('hides owner icon buttons for a participant card', () => {
    const { queryByTestId } = render(<TripPlanCard trip={trip} />);

    expect(queryByTestId('trip-plan-card-edit-1')).toBeNull();
    expect(queryByTestId('trip-plan-card-delete-1')).toBeNull();
  });
});
