import { render } from '@testing-library/react-native';

import type { PlannedTrip, TripParticipant } from '@/api/plannedTrips';
import TripParticipantsList from '@/components/trips/planning/TripParticipantsList';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_target, key) => String(key) }) as unknown as Record<string, string>,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { userId: number | null }) => unknown) => selector({ userId: 1 }),
}));

jest.mock('@/components/profile/UserSafetyMenu', () => () => null);

const participant = (id: number, rsvp: TripParticipant['rsvp']): TripParticipant => ({
  id,
  name: `Участник ${id}`,
  avatarUrl: null,
  rsvp,
  role: id === 1 ? 'organizer' : 'participant',
});

const tripWith = (participants: TripParticipant[]): PlannedTrip =>
  ({
    id: 1,
    slug: 'trip-1',
    title: 'Поездка',
    description: '',
    startDate: '2026-08-01',
    startTime: '09:00',
    transport: 'car',
    visibility: 'private',
    seatsTotal: 8,
    startPoint: null,
    status: 'planning',
    organizer: { id: 1, name: 'Организатор', avatarUrl: null },
    route: [],
    routeGeometry: null,
    routeSummary: null,
    routingState: null,
    participants,
    coverUrl: null,
    region: 'Минск',
    publishedToCommunity: false,
    report: null,
    isOwner: true,
    myRsvp: 'going',
    createdAt: '2026-07-11T10:00:00Z',
  }) as PlannedTrip;

const listOf = (total: number, going: number): PlannedTrip =>
  tripWith(
    Array.from({ length: total }, (_, index) =>
      participant(index + 1, index < going ? 'going' : 'maybe'),
    ),
  );

// #1335: сводка собиралась из переводных фрагментов («{n} » + « участников · » +
// «{n} » + « едут»): в RU выходил двойной пробел, в BE/UK/PL/EN — склейка после
// «·», а форма числа всегда была many. Проверяем сырой вывод: getByText
// нормализует пробелы и такой дефект пропускает.
describe('TripParticipantsList summary line', () => {
  it.each([
    [1, 1, '1 участник · 1 едет'],
    [2, 2, '2 участника · 2 едут'],
    [5, 3, '5 участников · 3 едут'],
  ])('uses the locale plural form for %i participants', (total, going, expected) => {
    const text = JSON.stringify(render(<TripParticipantsList trip={listOf(total, going)} />).toJSON());
    expect(text).toContain(expected);
  });

  it('renders the summary as one string instead of glued fragments', () => {
    const { getByText } = render(<TripParticipantsList trip={listOf(3, 2)} />);

    // Один цельный дочерний узел: склейка фрагментов дала бы массив, а
    // getByText нормализует краевые пробелы и дефект не поймал бы.
    expect(getByText('3 участника · 2 едут').props.children).toBe('3 участника · 2 едут');
  });

  it('keeps the hint when nobody joined yet', () => {
    const { queryByText, getByText } = render(<TripParticipantsList trip={tripWith([])} />);

    expect(queryByText(/участник/)).toBeNull();
    expect(getByText('Пока никто не присоединился.')).toBeTruthy();
  });
});
