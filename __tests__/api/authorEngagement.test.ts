import {
  AUTHOR_ENGAGEMENT_PAGE_SIZE,
  fetchAuthorEngagementDetails,
  normalizeAuthorEngagementPage,
  resolveAuthorEngagementMetric,
} from '@/api/authorEngagement';

const mockGet = jest.fn();

jest.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'favorites:11',
  metric: 'favorites',
  occurred_at: '2026-07-30T10:00:00Z',
  identity_hidden: false,
  user: { id: 7, first_name: 'Иван', last_name: 'Петров', avatar: 'https://cdn/a.jpg' },
  travel: {
    id: 682,
    name: 'Гарц',
    slug: 'garz',
    url: '/travels/garz',
    travel_image_thumb_url: 'https://cdn/t.jpg',
  },
  ...overrides,
});

describe('resolveAuthorEngagementMetric', () => {
  it('maps profile summary keys to API metrics', () => {
    expect(resolveAuthorEngagementMetric('favoritesCount')).toBe('favorites');
    expect(resolveAuthorEngagementMetric('wishlistCount')).toBe('wishlist');
    expect(resolveAuthorEngagementMetric('visitedCount')).toBe('visited');
    expect(resolveAuthorEngagementMetric('plannedCount')).toBe('planned');
  });

  it('returns null for unknown or missing keys', () => {
    expect(resolveAuthorEngagementMetric(null)).toBeNull();
    expect(resolveAuthorEngagementMetric(undefined)).toBeNull();
    expect(resolveAuthorEngagementMetric('viewsCount')).toBeNull();
  });
});

describe('normalizeAuthorEngagementPage', () => {
  it('normalizes the paginated envelope into camelCase items', () => {
    const page = normalizeAuthorEngagementPage(
      { count: 1, total: 1, next: null, results: [buildItem()] },
      'favorites',
      1,
    );

    expect(page.total).toBe(1);
    expect(page.nextPage).toBeNull();
    expect(page.items).toEqual([
      {
        id: 'favorites:11',
        metric: 'favorites',
        occurredAt: '2026-07-30T10:00:00Z',
        identityHidden: false,
        user: { id: 7, firstName: 'Иван', lastName: 'Петров', avatar: 'https://cdn/a.jpg' },
        travel: {
          id: 682,
          name: 'Гарц',
          slug: 'garz',
          url: '/travels/garz',
          imageUrl: 'https://cdn/t.jpg',
        },
      },
    ]);
  });

  it('reads the `data` envelope form as well', () => {
    const page = normalizeAuthorEngagementPage(
      { total: 1, data: [buildItem()] },
      'favorites',
      1,
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0].travel.slug).toBe('garz');
  });

  it('strips identity for hidden rows instead of leaking a partial profile', () => {
    const page = normalizeAuthorEngagementPage(
      {
        count: 1,
        results: [
          buildItem({
            identity_hidden: true,
            user: { id: 7, first_name: 'Иван', last_name: 'Петров', avatar: 'https://cdn/a.jpg' },
          }),
        ],
      },
      'favorites',
      1,
    );

    expect(page.items[0].identityHidden).toBe(true);
    expect(page.items[0].user).toEqual({ id: null, firstName: '', lastName: '', avatar: null });
  });

  it('advances the cursor while the server reports a next page', () => {
    const results = Array.from({ length: AUTHOR_ENGAGEMENT_PAGE_SIZE }, (_, index) =>
      buildItem({ id: `favorites:${index}` }),
    );

    const first = normalizeAuthorEngagementPage(
      { count: 45, next: 'https://metravel.by/api/travels/author-engagement/?page=2', results },
      'favorites',
      1,
    );
    expect(first.nextPage).toBe(2);

    const last = normalizeAuthorEngagementPage(
      { count: 45, next: null, results: [buildItem()] },
      'favorites',
      3,
    );
    expect(last.nextPage).toBeNull();
  });

  it('does not ask for another page when the current one came back empty', () => {
    const page = normalizeAuthorEngagementPage(
      { count: 100, next: 'https://metravel.by/api/travels/author-engagement/?page=6', results: [] },
      'favorites',
      5,
    );

    expect(page.items).toEqual([]);
    expect(page.nextPage).toBeNull();
  });

  it('drops unparsable dates and non-positive ids', () => {
    const page = normalizeAuthorEngagementPage(
      {
        count: 1,
        results: [
          buildItem({
            occurred_at: 'not-a-date',
            user: { id: 0, first_name: '', last_name: '', avatar: '' },
            travel: { id: null, name: '', slug: '', url: '', travel_image_thumb_url: '' },
          }),
        ],
      },
      'wishlist',
      1,
    );

    expect(page.items[0].occurredAt).toBeNull();
    expect(page.items[0].user.id).toBeNull();
    expect(page.items[0].user.avatar).toBeNull();
    expect(page.items[0].travel.id).toBeNull();
    expect(page.items[0].metric).toBe('wishlist');
  });
});

describe('fetchAuthorEngagementDetails', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('requests only the metric contract and never an arbitrary author id', async () => {
    mockGet.mockResolvedValue({ count: 0, results: [] });

    await fetchAuthorEngagementDetails('visited', 2);

    const [url] = mockGet.mock.calls[0];
    expect(url).toContain('/travels/author-engagement/');
    expect(url).toContain('metric=visited');
    expect(url).toContain('page=2');
    expect(url).toContain(`perPage=${AUTHOR_ENGAGEMENT_PAGE_SIZE}`);
    expect(url).not.toContain('author_id');
    expect(url).not.toContain('user_id');
  });

  it('propagates API errors instead of masking them with an empty list', async () => {
    mockGet.mockRejectedValue(new Error('boom'));

    await expect(fetchAuthorEngagementDetails('favorites')).rejects.toThrow('boom');
  });
});
