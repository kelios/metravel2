/**
 * #3130 (2а) — имена параметров фильтров как у бэкенда (`filterset_fields =
 * color, category, status`; `categories=1,2`; `search`; `ordering`). Прежние
 * `colors`/`statuses`/`sortBy`/`sortOrder` сервер молча игнорировал.
 */
jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

jest.mock('@/i18n', () => ({ translate: (k: string) => k }));

import { apiClient } from '@/api/client';
import { resolveOrderingParam, userPointsApi } from '@/api/userPoints';

const mockedGet = apiClient.get as jest.Mock;

const lastParams = () => {
  const endpoint: string = mockedGet.mock.calls.at(-1)?.[0] ?? '';
  return new URLSearchParams(endpoint.split('?')[1] ?? '');
};

describe('buildPointsEndpoint (#3130 2а)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });

  it('шлёт одиночные color/status, numeric categories, search и ordering', async () => {
    await userPointsApi.getPoints({
      colors: ['red'],
      statuses: ['visited'],
      categoryIds: ['3', '12'],
      search: 'водопад',
      sortBy: 'date',
      sortOrder: 'desc',
      page: 2,
      perPage: 200,
    } as any);
    const params = lastParams();
    expect(params.get('color')).toBe('red');
    expect(params.get('status')).toBe('visited');
    expect(params.get('categories')).toBe('3,12');
    expect(params.get('search')).toBe('водопад');
    expect(params.get('ordering')).toBe('-imported_at');
    expect(params.get('page')).toBe('2');
    expect(params.get('perPage')).toBe('200');
    for (const legacy of ['colors', 'statuses', 'sortBy', 'sortOrder']) {
      expect(params.has(legacy)).toBe(false);
    }
  });

  it('несколько цветов/статусов и нечисловые категории на сервер не уходят (фильтр на клиенте)', async () => {
    await userPointsApi.getPoints({
      colors: ['red', 'blue'],
      statuses: ['visited', 'planning'],
      categoryIds: ['3', 'museum'],
      sortBy: 'distance',
    } as any);
    const params = lastParams();
    expect(params.has('color')).toBe(false);
    expect(params.has('status')).toBe(false);
    expect(params.has('categories')).toBe(false);
    expect(params.has('ordering')).toBe(false);
  });

  it('getPointsPage шлёт только page/perPage', async () => {
    await userPointsApi.getPointsPage(3, 200);
    expect([...lastParams().keys()].sort()).toEqual(['page', 'perPage']);
  });
});

describe('resolveOrderingParam', () => {
  it.each([
    ['name', 'asc', 'name'],
    ['name', 'desc', '-name'],
    ['date', undefined, 'imported_at'],
    ['rating', 'desc', '-rating'],
    ['distance', 'asc', null],
    [undefined, 'asc', null],
  ])('%s/%s → %s', (sortBy, sortOrder, expected) => {
    expect(resolveOrderingParam(sortBy as any, sortOrder as any)).toBe(expected);
  });
});
