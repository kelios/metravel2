import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';

jest.mock('@/api/client', () => ({
  apiClient: {
    patch: jest.fn(),
  },
}));

const mockedPatch = (require('@/api/client').apiClient.patch as jest.Mock);

describe('src/api/travelsFavorites', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('calls mark-as-favorite with relative URL (no double /api)', async () => {
    mockedPatch.mockResolvedValueOnce({ ok: true });

    await markTravelAsFavorite(123);

    expect(mockedPatch).toHaveBeenCalledWith('/travels/123/mark-as-favorite/');
  });

  it('calls unmark-as-favorite with relative URL (no double /api)', async () => {
    mockedPatch.mockResolvedValueOnce({ ok: true });

    await unmarkTravelAsFavorite('abc');

    expect(mockedPatch).toHaveBeenCalledWith('/travels/abc/unmark-as-favorite/');
  });
});
