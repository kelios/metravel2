import { mergeStravaActivities } from '@/hooks/useStravaIntegration';

describe('useStravaIntegration helpers', () => {
  it('appends paginated Strava activities and deduplicates by id', () => {
    const merged = mergeStravaActivities(
      [
        { id: '1', name: 'Morning Ride' },
        { id: '2', name: 'Lunch Run' },
      ],
      [
        { id: '2', name: 'Lunch Run updated', distanceMeters: 5000 },
        { id: '3', name: 'Evening Walk' },
      ],
    );

    expect(merged).toEqual([
      { id: '1', name: 'Morning Ride' },
      { id: '2', name: 'Lunch Run updated', distanceMeters: 5000 },
      { id: '3', name: 'Evening Walk' },
    ]);
  });
});
