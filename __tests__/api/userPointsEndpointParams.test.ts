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
import { USER_POINTS_IDS_MAX, resolveOrderingParam, userPointsApi } from '@/api/userPoints';

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

  it('getAllPins шлёт fields=pins и серверный search/categories без пагинации (#3161)', async () => {
    await userPointsApi.getAllPins({ search: 'озеро', categoryIds: ['7'] });
    const params = lastParams();
    expect(params.get('fields')).toBe('pins');
    expect(params.get('search')).toBe('озеро');
    expect(params.get('categories')).toBe('7');
    expect(params.has('page')).toBe(false);
    expect(params.has('perPage')).toBe(false);
  });

  it('getPointsByIds шлёт ids через запятую, без дублей, пачками по USER_POINTS_IDS_MAX (#3172)', async () => {
    mockedGet.mockResolvedValue([{ id: 1 }]);
    await userPointsApi.getPointsByIds([3, 1, 3, 0, Number.NaN]);
    expect(lastParams().get('ids')).toBe('3,1');
    expect(mockedGet).toHaveBeenCalledTimes(1);

    mockedGet.mockClear();
    const many = Array.from({ length: USER_POINTS_IDS_MAX + 5 }, (_, i) => i + 1);
    const items = await userPointsApi.getPointsByIds(many);
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
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
