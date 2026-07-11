/**
 * Unit tests for reorderGallery — persists user-defined gallery order.
 *
 * Newly added, uncommitted, zero coverage. It guards the gallery-reorder API
 * call with auth, id validation, and id de-duplication; a regression here
 * silently corrupts the saved photo order users just arranged.
 */

import { reorderGallery, updateGalleryCaption } from '@/api/misc';
import { apiClient } from '@/api/client';
import { getSecureItem } from '@/utils/secureStorage';

jest.mock('@/api/client');
jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockGetSecureItem = getSecureItem as jest.Mock;

describe('reorderGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecureItem.mockResolvedValue('token-123');
    mockedApiClient.request.mockResolvedValue({ gallery: [] });
  });

  it('throws when the user is not authenticated', async () => {
    mockGetSecureItem.mockResolvedValue(null);

    await expect(reorderGallery(1, [1, 2])).rejects.toThrow('Пользователь не авторизован');
    expect(mockedApiClient.request).not.toHaveBeenCalled();
  });

  it('throws on non-positive or non-integer travel id', async () => {
    await expect(reorderGallery(0, [1])).rejects.toThrow('Некорректный id путешествия');
    await expect(reorderGallery(-5, [1])).rejects.toThrow('Некорректный id путешествия');
    await expect(reorderGallery('abc', [1])).rejects.toThrow('Некорректный id путешествия');
    expect(mockedApiClient.request).not.toHaveBeenCalled();
  });

  it('returns an empty gallery without calling the API when no valid image ids', async () => {
    await expect(reorderGallery(10, [])).resolves.toEqual({ gallery: [] });
    await expect(reorderGallery(10, [0, -1, 'x', NaN])).resolves.toEqual({ gallery: [] });
    expect(mockedApiClient.request).not.toHaveBeenCalled();
  });

  it('dedupes and coerces image ids, then PATCHes /gallery/reorder/', async () => {
    const apiResponse = {
      gallery: [
        { id: 3, url: 'https://metravel.by/gallery/3/a.webp', order: 0 },
        { id: 1, url: 'https://metravel.by/gallery/1/b.webp', order: 1 },
      ],
    };
    mockedApiClient.request.mockResolvedValue(apiResponse);

    const result = await reorderGallery('42', ['3', 1, 3, '1', 2, 0, -7]);

    expect(mockedApiClient.request).toHaveBeenCalledTimes(1);
    const [path, options] = mockedApiClient.request.mock.calls[0];
    expect(path).toBe('/gallery/reorder/');
    expect(options).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse((options as { body: string }).body)).toEqual({
      travel_id: 42,
      image_ids: [3, 1, 2],
    });
    expect(result).toBe(apiResponse);
  });

  it('forwards the abort signal to apiClient', async () => {
    const controller = new AbortController();

    await reorderGallery(7, [1, 2], controller.signal);

    const [, options] = mockedApiClient.request.mock.calls[0];
    expect((options as { signal?: AbortSignal }).signal).toBe(controller.signal);
  });
});

describe('updateGalleryCaption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecureItem.mockResolvedValue('token-123');
  });

  it('trims the caption and PATCHes the gallery detail endpoint', async () => {
    mockedApiClient.request.mockResolvedValue({ id: 44, caption: 'Мирский замок' });

    await expect(updateGalleryCaption('44', '  Мирский замок  ')).resolves.toEqual({
      id: 44,
      caption: 'Мирский замок',
    });

    expect(mockedApiClient.request).toHaveBeenCalledWith(
      '/gallery/44/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ caption: 'Мирский замок' }),
      }),
      expect.any(Number),
    );
  });

  it('allows an empty caption and rejects invalid ids or captions over 500 characters', async () => {
    mockedApiClient.request.mockResolvedValue({ id: 44, caption: '' });

    await updateGalleryCaption(44, '   ');
    expect(JSON.parse((mockedApiClient.request.mock.calls[0][1] as { body: string }).body)).toEqual({
      caption: '',
    });

    await expect(updateGalleryCaption('temp-1', 'Место')).rejects.toThrow('Некорректный id изображения');
    await expect(updateGalleryCaption(44, 'x'.repeat(501))).rejects.toThrow('500 символов');
  });
});
