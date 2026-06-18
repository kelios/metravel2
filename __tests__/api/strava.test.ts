import {
  normalizeStravaActivities,
  normalizeStravaActivityDetail,
  normalizeStravaStatus,
} from '@/api/strava';

describe('Strava API normalizers', () => {
  it('normalizes connected status without exposing token fields', () => {
    const status = normalizeStravaStatus({
      status: 'connected',
      connected: true,
      athlete: {
        id: 42,
        firstname: 'Alex',
        lastname: 'Runner',
      },
      scopes: ['read', 'activity:read'],
      access_token: 'secret-access-token',
      refresh_token: 'secret-refresh-token',
      last_sync_at: '2026-06-18T10:00:00Z',
    });

    expect(status).toMatchObject({
      status: 'connected',
      connected: true,
      athlete: {
        id: '42',
        firstname: 'Alex',
        lastname: 'Runner',
      },
      scopes: ['read', 'activity:read'],
      lastSyncAt: '2026-06-18T10:00:00Z',
    });
    expect(JSON.stringify(status)).not.toContain('secret-access-token');
    expect(JSON.stringify(status)).not.toContain('secret-refresh-token');
  });

  it('falls back to backend_config_error for unsupported status payloads', () => {
    expect(normalizeStravaStatus(null)).toMatchObject({
      status: 'backend_config_error',
      connected: false,
      requiredScopes: ['read', 'activity:read'],
    });
  });

  it('normalizes paginated activity list with retention metadata', () => {
    const activities = normalizeStravaActivities(
      {
        results: [
          {
            id: 123,
            name: 'Morning Ride',
            sport_type: 'Ride',
            start_date: '2026-06-18T07:00:00Z',
            distance: 32100,
            moving_time: 4200,
            total_elevation_gain: 450,
            cache_expires_at: '2026-06-25T07:00:00Z',
          },
        ],
        page: 1,
        per_page: 10,
        total: 12,
      },
      { page: 1, perPage: 10 },
    );

    expect(activities).toMatchObject({
      page: 1,
      perPage: 10,
      total: 12,
      hasMore: true,
      data: [
        {
          id: '123',
          name: 'Morning Ride',
          sportType: 'Ride',
          distanceMeters: 32100,
          movingTimeSeconds: 4200,
          totalElevationGainMeters: 450,
          cacheExpiresAt: '2026-06-25T07:00:00Z',
        },
      ],
    });
  });

  it('normalizes detail fields only from the selected activity payload', () => {
    expect(
      normalizeStravaActivityDetail({
        id: 'abc',
        name: 'Trail Run',
        elapsed_time: 1800,
        average_speed: 3.2,
        map_polyline: 'encoded-polyline',
      }),
    ).toMatchObject({
      id: 'abc',
      name: 'Trail Run',
      elapsedTimeSeconds: 1800,
      averageSpeed: 3.2,
      mapPolyline: 'encoded-polyline',
    });
  });
});
