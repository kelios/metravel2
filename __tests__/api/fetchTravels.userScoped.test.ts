import { fetchTravels } from '@/src/api/travelsApi';

// Мокаем fetchWithTimeout, чтобы не делать реальные запросы, и анализируем URL
jest.mock('@/src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(async () => ({
    ok: true,
  })),
}));

jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(async () => ({ data: [], total: 0 })),
}));

const { fetchWithTimeout } =
  require('@/src/utils/fetchWithTimeout') as {
    fetchWithTimeout: jest.Mock;
  };

describe('fetchTravels user-scoped behaviour', () => {
  beforeEach(() => {
    fetchWithTimeout.mockClear();
  });

  it('должен добавлять publish/moderation по умолчанию для глобальных списков (без user_id)', async () => {
    const result = await fetchTravels(0, 10, '', {}, {} as any);

    expect(result).toEqual({ data: [], total: 0 });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);

    const calledUrl = fetchWithTimeout.mock.calls[0][0] as string;
    const url = new URL(calledUrl, 'https://example.test');
    const whereRaw = url.searchParams.get('where');
    expect(whereRaw).toBeTruthy();
    const where = JSON.parse(whereRaw || '{}');

    expect(where).toMatchObject({ publish: 1, moderation: 1 });
    expect(where.user_id).toBeUndefined();
  });

  it('не должен добавлять publish/moderation по умолчанию, когда передан user_id ("Мои путешествия")', async () => {
    const result = await fetchTravels(0, 10, '', { user_id: 123 }, {} as any);

    expect(result).toEqual({ data: [], total: 0 });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);

    const calledUrl = fetchWithTimeout.mock.calls[0][0] as string;
    const url = new URL(calledUrl, 'https://example.test');
    const whereRaw = url.searchParams.get('where');
    expect(whereRaw).toBeTruthy();
    const where = JSON.parse(whereRaw || '{}');

    expect(where.user_id).toBe(123);
    expect(where.publish).toBeUndefined();
    expect(where.moderation).toBeUndefined();
  });
});
