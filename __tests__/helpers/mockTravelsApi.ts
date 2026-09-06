import type { MyTravelsItem, MyTravelsPayload } from '@/api/travelsApi';
import { extractTravelEngagementStats } from '@/utils/travelEngagementStats'
import { DRAFT_PUBLICATION_STATUSES, isTravelDraft } from '@/utils/travelPublicationStatus'

export const mockFetchMyTravels = jest.fn();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toItems = (value: unknown): MyTravelsItem[] =>
  Array.isArray(value) ? (value as MyTravelsItem[]) : [];

export const mockUnwrapMyTravelsPayload = (payload: MyTravelsPayload | null | undefined) => {
  if (!payload) return { items: [], total: 0, engagementSummary: null };

  if (Array.isArray(payload)) return { items: payload, total: payload.length, engagementSummary: null };

  const obj = asRecord(payload);
  const engagementSummary = extractTravelEngagementStats(obj)
  const data = toItems(obj.data);
  if (data.length > 0) {
    return {
      items: data,
      total: Number(obj.total ?? obj.count ?? data.length) || data.length,
      engagementSummary,
    };
  }

  const results = toItems(obj.results);
  if (results.length > 0) {
    return {
      items: results,
      total: Number(obj.count ?? obj.total ?? results.length) || results.length,
        engagementSummary,
    };
  }

  const items = toItems(obj.items);
  if (items.length > 0) {
    return {
      items,
      total: Number(obj.total ?? obj.count ?? items.length) || items.length,
        engagementSummary,
    };
  }

  return { items: [], total: Number(obj.total ?? obj.count ?? 0) || 0, engagementSummary };
};

// Профиль спрашивает у API отдельный счётчик черновиков
// (`where.publication_status`), поэтому фейк обязан уважать этот фильтр: иначе
// на счётчик приходит весь список автора и тест не отличит серверную разбивку
// от подсчёта по загруженной странице.
export const mockMyTravelsPayload = (items: MyTravelsItem[]) => {
  mockFetchMyTravels.mockImplementation(async (params: { publicationStatus?: readonly string[] } = {}) => {
    const requestedStatuses = params?.publicationStatus;
    const scoped = Array.isArray(requestedStatuses) && requestedStatuses.length > 0
      ? items.filter((item) => {
          const wantsDrafts = requestedStatuses.every(
            (status) => (DRAFT_PUBLICATION_STATUSES as readonly string[]).includes(status),
          );
          return isTravelDraft(item as never) === wantsDrafts;
        })
      : items;
    return { total: scoped.length, count: scoped.length, data: scoped };
  });
};

export const resetTravelsApiMocks = () => {
  mockFetchMyTravels.mockReset();
  mockFetchMyTravels.mockResolvedValue([]);
};
