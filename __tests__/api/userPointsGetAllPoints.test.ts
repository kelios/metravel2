/**
 * #1706 — `/api/user-points/` режет страницу серверным потолком 200 (#752).
 * `getAllPoints` обязан просить ровно потолок и дочитывать остаток по `count`,
 * иначе коллекция молча обрезается (класс `API-PAGE-SIZE-CAP-001`).
 */
jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

jest.mock('@/i18n', () => ({ translate: (k: string) => k }));

import { apiClient } from '@/api/client';
import { userPointsApi } from '@/api/userPoints';

const mockedGet = apiClient.get as jest.Mock;

const makePoints = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: from + i, latitude: 0, longitude: 0 }));

const parsePageParams = (endpoint: string) => {
  const query = endpoint.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  return { page: params.get('page'), perPage: params.get('perPage') };
};

describe('userPointsApi.getAllPoints', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('дочитывает все страницы по count и просит серверный потолок 200', async () => {
    const TOTAL = 2656;
    mockedGet.mockImplementation(async (endpoint: string) => {
      const { page } = parsePageParams(endpoint);
      const pageNum = Number(page);
      const offset = (pageNum - 1) * 200;
      const size = Math.min(200, TOTAL - offset);
      return { count: TOTAL, next: null, previous: null, results: makePoints(offset + 1, size) };
    });

    const points = await userPointsApi.getAllPoints();

    expect(points).toHaveLength(TOTAL);
    // 2656 / 200 = 14 страниц; запрошенный perPage всегда равен серверному потолку.
    expect(mockedGet).toHaveBeenCalledTimes(14);
    const requested = mockedGet.mock.calls.map(([endpoint]) => parsePageParams(endpoint));
    expect(requested.every((p) => p.perPage === '200')).toBe(true);
    expect(requested.map((p) => Number(p.page)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(new Set(points.map((p) => p.id)).size).toBe(TOTAL);
  });

  it('не делает второй запрос, когда коллекция помещается в одну страницу', async () => {
    mockedGet.mockResolvedValue({
      count: 12,
      next: null,
      previous: null,
      results: makePoints(1, 12),
    });

    const points = await userPointsApi.getAllPoints();

    expect(points).toHaveLength(12);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('переносит фильтры в каждый запрос страницы', async () => {
    mockedGet.mockResolvedValue({ count: 1, next: null, previous: null, results: makePoints(1, 1) });

    await userPointsApi.getAllPoints({ statuses: ['visited'] });

    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining('statuses=visited'),
      expect.any(Number),
    );
  });

  it('переживает непагинированный ответ голым массивом', async () => {
    mockedGet.mockResolvedValue(makePoints(1, 300));

    const points = await userPointsApi.getAllPoints();

    expect(points).toHaveLength(300);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
