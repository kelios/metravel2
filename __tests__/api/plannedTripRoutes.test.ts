// #1496 — клиент хранилища исходных файлов маршрута поездки поверх контракта
// `/api/trips/planned/{id}/routes/` (#1493, #1840: zero or more files, owner-only).
import {
  deletePlannedTripRouteFile,
  downloadPlannedTripRouteFileBlob,
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

  // #2069: бэкенд хранит до десяти файлов (#1840), а клиент сводил список к
  // первому — второй загруженный трек не видели ни карта, ни «Файл маршрута».
  it('keeps every file of the list in backend order instead of the first one', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    await expect(listPlannedTripRouteFiles(47)).resolves.toEqual([]);

    apiClient.get.mockResolvedValueOnce([
      { ...serverFile, id: 4, original_name: 'Mullerthal_Trail_Routes_1-3.kml', ext: 'kml', sort_order: 0 },
      { ...serverFile, id: 11, original_name: 'Mullerthal_Trail_po_dnyam.gpx', ext: 'gpx', sort_order: 1 },
    ]);
    const files = await listPlannedTripRouteFiles(47);

    expect(apiClient.get).toHaveBeenLastCalledWith('/trips/planned/47/routes/', expect.any(Number));
    expect(files.map((file) => [file.id, file.original_name, file.ext])).toEqual([
      [4, 'Mullerthal_Trail_Routes_1-3.kml', 'kml'],
      [11, 'Mullerthal_Trail_po_dnyam.gpx', 'gpx'],
    ]);
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

  it('deletes and downloads one file by its route id', async () => {
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
