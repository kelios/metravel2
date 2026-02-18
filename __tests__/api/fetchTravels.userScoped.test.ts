import { fetchTravels } from '@/api/travelsApi';

// Мокаем fetchWithTimeout, чтобы не делать реальные запросы, и анализируем URL
jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(async () => ({
    ok: true,
  })),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(async () => ({ data: [], total: 0 })),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(async () => 'test-token'),
}));

const { fetchWithTimeout } =
  require('@/utils/fetchWithTimeout') as {
    fetchWithTimeout: jest.Mock;
  };

const { safeJsonParse } =
  require('@/utils/safeJsonParse') as {
    safeJsonParse: jest.Mock;
  };

describe('fetchTravels user-scoped behaviour', () => {
  beforeEach(() => {
    fetchWithTimeout.mockClear();
    safeJsonParse.mockClear();
  });

  it('должен добавлять publish/moderation по умолчанию для глобальных списков (без user_id)', async () => {
    const result = await fetchTravels(0, 10, '', {}, {} as any);

    expect(result).toEqual({ data: [], total: 0 });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);

    const calledUrl = fetchWithTimeout.mock.calls[0][0] as string;
    const init = fetchWithTimeout.mock.calls[0][1] as any;
    const url = new URL(calledUrl, 'https://example.test');
    const whereRaw = url.searchParams.get('where');
    expect(whereRaw).toBeTruthy();
    const where = JSON.parse(whereRaw || '{}');

    expect(where).toMatchObject({ publish: 1, moderation: 1 });
    expect(where.user_id).toBeUndefined();
    expect(init?.headers?.Authorization).toBeUndefined();
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

  it('возвращает черновики для user-scoped списка без publish/moderation при наличии токена', async () => {
    safeJsonParse.mockResolvedValueOnce({
      data: [{ id: 1, publish: 0, moderation: 0 } as any],
      total: 1,
    });

    const result = await fetchTravels(0, 10, '', { user_id: 123 }, {} as any);

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).id).toBe(1);
    expect((result.data[0] as any).publish).toBe(0);
    expect((result.data[0] as any).moderation).toBe(0);

    const init = fetchWithTimeout.mock.calls[0][1] as any;
    expect(init?.headers?.Authorization).toBe('Token test-token');
  });
});
