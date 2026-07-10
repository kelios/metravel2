import {
  getTripFallbackCover,
  getTripFallbackCoverSeason,
} from '@/components/trips/planning/tripFallbackCover';

const baseTrip = {
  id: 42,
  startDate: '2026-07-10',
  title: 'Летняя поездка',
  transport: 'car' as const,
  region: 'Минск',
};

describe('tripFallbackCover', () => {
  it.each([
    ['2026-01-15', 'winter'],
    ['2026-04-15', 'spring'],
    ['2026-07-15', 'summer'],
    ['2026-10-15', 'autumn'],
    ['2026-12-15', 'winter'],
  ] as const)('selects %s cover from trip start date', (startDate, expectedSeason) => {
    expect(getTripFallbackCoverSeason({ ...baseTrip, startDate })).toBe(expectedSeason);
  });

  it('keeps fallback stable when start date cannot be parsed', () => {
    const trip = { ...baseTrip, startDate: 'not-a-date', title: 'Поездка без даты' };

    expect(getTripFallbackCoverSeason(trip)).toBe(getTripFallbackCoverSeason(trip));
  });

  it('supports public trip-like input with nullable metadata', () => {
    expect(
      getTripFallbackCoverSeason({
        startDate: null,
        title: 'Поездка без обложки',
        transport: null,
        region: null,
      }),
    ).toEqual(expect.stringMatching(/^(spring|summer|autumn|winter)$/));
  });

  it('returns a resolved local asset uri for missing covers', () => {
    const fallback = getTripFallbackCover(baseTrip);

    expect(fallback.key).toBe('trip-fallback-summer-42');
    expect(fallback.uri).toEqual(expect.any(String));
    expect(fallback.uri.length).toBeGreaterThan(0);
  });
});
