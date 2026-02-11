export const mockFetchMyTravels = jest.fn();

export const mockUnwrapMyTravelsPayload = (payload: any) => {
  if (!payload) return { items: [], total: 0 };
  if (Array.isArray(payload)) return { items: payload, total: payload.length };
  if (Array.isArray(payload?.data)) return { items: payload.data, total: payload.data.length };
  if (Array.isArray(payload?.results)) {
    return {
      items: payload.results,
      total: Number(payload.count ?? payload.total ?? payload.results.length) || payload.results.length,
    };
  }
  if (Array.isArray(payload?.items)) {
    return {
      items: payload.items,
      total: Number(payload.total ?? payload.count ?? payload.items.length) || payload.items.length,
    };
  }
  return { items: [], total: Number(payload?.total ?? payload?.count ?? 0) || 0 };
};

export const resetTravelsApiMocks = () => {
  mockFetchMyTravels.mockReset();
  mockFetchMyTravels.mockResolvedValue([]);
};

