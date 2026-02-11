import type { MyTravelsItem, MyTravelsPayload } from '@/api/travelsApi';

export const mockFetchMyTravels = jest.fn();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toItems = (value: unknown): MyTravelsItem[] =>
  Array.isArray(value) ? (value as MyTravelsItem[]) : [];

export const mockUnwrapMyTravelsPayload = (payload: MyTravelsPayload | null | undefined) => {
  if (!payload) return { items: [], total: 0 };

  if (Array.isArray(payload)) return { items: payload, total: payload.length };

  const obj = asRecord(payload);
  const data = toItems(obj.data);
  if (data.length > 0) {
    return { items: data, total: data.length };
  }

  const results = toItems(obj.results);
  if (results.length > 0) {
    return {
      items: results,
      total: Number(obj.count ?? obj.total ?? results.length) || results.length,
    };
  }

  const items = toItems(obj.items);
  if (items.length > 0) {
    return {
      items,
      total: Number(obj.total ?? obj.count ?? items.length) || items.length,
    };
  }

  return { items: [], total: Number(obj.total ?? obj.count ?? 0) || 0 };
};

export const resetTravelsApiMocks = () => {
  mockFetchMyTravels.mockReset();
  mockFetchMyTravels.mockResolvedValue([]);
};
