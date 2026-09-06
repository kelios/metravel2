// Счётчик черновиков профиля живёт на серверном фильтре where.publication_status:
// список статусов бэкенд валидирует по choices и превращает в publication_status__in.
// Если фильтр уедет из where, ответ вернёт ВСЕ маршруты автора и счётчик соврёт молча.

import { fetchMyTravels } from '@/api/travelsApi';
import { DRAFT_PUBLICATION_STATUSES } from '@/utils/travelPublicationStatus';

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(async () => ({ ok: true })),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(async () => ({ results: [], count: 0 })),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(async () => 'test-token'),
}));

const { fetchWithTimeout } = require('@/utils/fetchWithTimeout') as { fetchWithTimeout: jest.Mock };

const lastWhere = () => {
  const calledUrl = fetchWithTimeout.mock.calls[0][0] as string;
  const url = new URL(calledUrl, 'https://example.test');
  return {
    where: JSON.parse(url.searchParams.get('where') || '{}'),
    perPage: url.searchParams.get('perPage'),
  };
};

beforeEach(() => {
  fetchWithTimeout.mockClear();
});

describe('fetchMyTravels — фильтр по статусу публикации', () => {
  it('кладёт список статусов в where и не подменяет его дефолтом publish/moderation', async () => {
    await fetchMyTravels({
      user_id: 7,
      page: 1,
      perPage: 1,
      includeDrafts: true,
      publicationStatus: DRAFT_PUBLICATION_STATUSES,
    });

    const { where, perPage } = lastWhere();
    expect(where).toMatchObject({ user_id: 7, publication_status: ['draft', 'pending_review'] });
    expect(where.publish).toBeUndefined();
    expect(where.moderation).toBeUndefined();
    expect(perPage).toBe('1');
  });

  it('без includeDrafts статус остаётся явным фильтром, а не сваливается в publish=1', async () => {
    await fetchMyTravels({ user_id: 7, publicationStatus: ['approved', 'published'] });

    const { where } = lastWhere();
    expect(where.publication_status).toEqual(['approved', 'published']);
    expect(where.publish).toBeUndefined();
    expect(where.moderation).toBeUndefined();
  });

  it('пустой список статусов не попадает в where — иначе бэкенд отдаст 400', async () => {
    await fetchMyTravels({ user_id: 7, includeDrafts: true, publicationStatus: [] });

    const { where } = lastWhere();
    expect(where).toEqual({ user_id: 7 });
  });
});
