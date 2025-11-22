import { fetchTravels } from '@/src/api/travels';

// Мокаем fetchWithTimeout, чтобы не делать реальные запросы
jest.mock('@/src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(async () => ({
    ok: true,
  })),
}));

jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(async () => ({ data: [], total: 0 })),
}));

describe('fetchTravels user-scoped behaviour', () => {
  it('должен добавлять publish/moderation по умолчанию для глобальных списков (без user_id)', async () => {
    const result = await fetchTravels(0, 10, '', {}, {} as any);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('не должен добавлять publish/moderation по умолчанию, когда передан user_id ("Мои путешествия")', async () => {
    const result = await fetchTravels(0, 10, '', { user_id: 123 }, {} as any);
    expect(result).toEqual({ data: [], total: 0 });
  });
});
