// #1496 — клиент хранилища исходного файла маршрута поездки поверх контракта
// #1493 `/api/trips/planned/{id}/routes/` (zero-or-one primary file, owner-only).
import {
  deletePlannedTripRouteFile,
  downloadPlannedTripRouteFileBlob,
  fetchPlannedTripRouteFile,
  listPlannedTripRouteFiles,
  uploadPlannedTripRouteFile,
} from '@/api/plannedTripRoutes';

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    delete: jest.fn(),
    download: jest.fn(),
    uploadFormData: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const { apiClient } = jest.requireMock('@/api/client') as {
  apiClient: {
    get: jest.Mock;
    delete: jest.Mock;
    download: jest.Mock;
    uploadFormData: jest.Mock;
  };
};

const serverFile = {
  id: 42,
  original_name: 'weekend-route.gpx',
  ext: 'GPX',
  size: 184392,
  download_url: 'https://example.test/api/trips/planned/7/routes/42/download/',
  created_at: '2026-08-18T21:45:00Z',
  updated_at: '2026-08-18T21:46:00Z',
};

const appendSpy = jest.spyOn(FormData.prototype, 'append');

describe('plannedTripRoutes API', () => {
  beforeEach(() => {
    appendSpy.mockClear();
    apiClient.get.mockReset();
    apiClient.delete.mockReset();
    apiClient.download.mockReset();
    apiClient.uploadFormData.mockReset();
  });

  it('reads the metadata list from the documented endpoint', async () => {
    apiClient.get.mockResolvedValue([serverFile]);

    const files = await listPlannedTripRouteFiles(7);

    expect(apiClient.get).toHaveBeenCalledWith('/trips/planned/7/routes/', expect.any(Number));
    expect(files).toEqual([
      {
        id: 42,
        original_name: 'weekend-route.gpx',
        ext: 'gpx',
        size: 184392,
        download_url: serverFile.download_url,
        created_at: '2026-08-18T21:45:00Z',
        updated_at: '2026-08-18T21:46:00Z',
      },
    ]);
  });

  it('accepts a paginated list wrapper and skips records without an id', async () => {
    apiClient.get.mockResolvedValue({ results: [{ original_name: 'no-id.gpx' }, serverFile] });

    await expect(listPlannedTripRouteFiles(7)).resolves.toHaveLength(1);
  });

  it('reduces the zero-or-one list to the primary file', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    await expect(fetchPlannedTripRouteFile(7)).resolves.toBeNull();

    apiClient.get.mockResolvedValueOnce([serverFile]);
    await expect(fetchPlannedTripRouteFile(7)).resolves.toMatchObject({ id: 42, ext: 'gpx' });
  });

  it('uploads the picked file as multipart `file` without rebuilding its bytes', async () => {
    apiClient.uploadFormData.mockResolvedValue({ ...serverFile, ext: 'kml' });
    const picked = { uri: 'file:///cache/trip-route-import/a.kml', name: 'a.kml', type: 'application/vnd.google-earth.kml+xml' };

    const uploaded = await uploadPlannedTripRouteFile(7, picked);

    const [endpoint, formData, method] = apiClient.uploadFormData.mock.calls[0];
    expect(endpoint).toBe('/trips/planned/7/routes/');
    expect(method).toBe('POST');
    // RN-полифилл FormData хранит части в `getParts()`; web-FormData отдаёт `get()`.
    const part = typeof (formData as { getParts?: () => Array<Record<string, unknown>> }).getParts === 'function'
      ? (formData as unknown as { getParts: () => Array<Record<string, unknown>> }).getParts()[0]
      : (formData as FormData).get('file');
    expect(appendSpy).toHaveBeenCalledWith('file', picked);
    expect(part).toBeTruthy();
    expect(uploaded).toMatchObject({ id: 42, ext: 'kml' });
  });

  it('deletes and downloads the primary file by its route id', async () => {
    apiClient.delete.mockResolvedValue(null);
    await deletePlannedTripRouteFile(7, 42);
    expect(apiClient.delete).toHaveBeenCalledWith('/trips/planned/7/routes/42/', expect.any(Number));

    const downloadedBlob = { text: async () => '<gpx/>' } as Blob;
    apiClient.download.mockResolvedValue({
      blob: downloadedBlob,
      contentType: 'application/gpx+xml',
      filename: 'weekend-route.gpx',
    });

    await expect(downloadPlannedTripRouteFileBlob(7, 42)).resolves.toEqual({
      text: '<gpx/>',
      blob: downloadedBlob,
      bytes: undefined,
      contentType: 'application/gpx+xml',
      filename: 'weekend-route.gpx',
    });
    expect(apiClient.download).toHaveBeenCalledWith(
      '/trips/planned/7/routes/42/download/',
      { method: 'GET' },
      expect.any(Number),
    );
  });

  it('escapes path segments instead of interpolating them raw', async () => {
    apiClient.get.mockResolvedValue([]);

    await listPlannedTripRouteFiles('7/../9');

    expect(apiClient.get).toHaveBeenCalledWith('/trips/planned/7%2F..%2F9/routes/', expect.any(Number));
  });
});
