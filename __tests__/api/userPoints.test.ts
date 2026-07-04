import { userPointsApi } from '@/api/userPoints';

const mockUploadFormData = jest.fn();

jest.mock('@/api/client', () => ({
  apiClient: {
    uploadFormData: (...args: any[]) => mockUploadFormData(...args),
  },
}));

describe('userPointsApi.importPoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadFormData.mockResolvedValue({ created: 1, updated: 0, skipped: 0, errors: [] });
  });

  it('uses DocumentPickerAsset.file on web without fetching blob uri', async () => {
    const previousFetch = (global as any).fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    try {
      const webFile = new File(['{"type":"FeatureCollection","features":[]}'], 'points.geojson', {
        type: 'application/geo+json',
      });
      const asset = {
        uri: 'blob:https://metravel.by/test',
        name: 'points.geojson',
        file: webFile,
      };

      await userPointsApi.importPoints(asset as any);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockUploadFormData).toHaveBeenCalledTimes(1);
      const formData = mockUploadFormData.mock.calls[0][1] as FormData;
      expect(formData.get('file')).toBe(webFile);
      // Backend now parses server-side: no dry_run on the real import.
      expect(formData.get('dry_run')).toBeNull();
    } finally {
      (global as any).fetch = previousFetch;
    }
  });

  it('uploads KMZ as-is (backend extracts KML server-side)', async () => {
    const kmzFile = new File(['PK-fake-zip'], 'Saved Places.kmz', {
      type: 'application/vnd.google-earth.kmz',
    });
    const asset = {
      uri: 'blob:https://metravel.by/test',
      name: 'Saved Places.kmz',
      file: kmzFile,
    };

    await userPointsApi.importPoints(asset as any);

    expect(mockUploadFormData).toHaveBeenCalledTimes(1);
    const formData = mockUploadFormData.mock.calls[0][1] as FormData;
    // The original .kmz is forwarded untouched — no client-side jszip extraction.
    expect(formData.get('file')).toBe(kmzFile);
  });

  it('forwards dedupe/default options as form fields', async () => {
    const webFile = new File(['{}'], 'p.geojson', { type: 'application/geo+json' });
    await userPointsApi.importPoints({ uri: 'x', name: 'p.geojson', file: webFile } as any, {
      dedupePolicy: 'skip',
      defaultColor: 'red',
      defaultStatus: 'want_to_visit',
    });

    const formData = mockUploadFormData.mock.calls[0][1] as FormData;
    expect(formData.get('dedupe_policy')).toBe('skip');
    expect(formData.get('default_color')).toBe('red');
    expect(formData.get('default_status')).toBe('want_to_visit');
  });
});

describe('userPointsApi.previewImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends dry_run=true and normalizes points_preview + summary', async () => {
    mockUploadFormData.mockResolvedValue({
      import_id: 'abc',
      dry_run: true,
      source: 'geojson',
      dedupe_policy: 'merge',
      points_preview: [
        {
          name: 'A',
          description: 'desc',
          latitude: 53.9,
          longitude: 27.56,
          address: null,
          color: 'brown',
          status: 'planned',
          source: 'geojson',
          original_id: null,
          category_ids: ['1'],
        },
      ],
      summary: {
        total_parsed: 1,
        valid: 1,
        created: 0,
        updated: 0,
        skipped: 0,
        duplicates: 0,
        warnings: ['w'],
        errors: [],
      },
    });

    const webFile = new File(['{}'], 'p.geojson', { type: 'application/geo+json' });
    const result = await userPointsApi.previewImport({ uri: 'x', name: 'p.geojson', file: webFile } as any);

    const formData = mockUploadFormData.mock.calls[0][1] as FormData;
    expect(formData.get('dry_run')).toBe('true');
    expect(formData.get('file')).toBe(webFile);

    expect(result.importId).toBe('abc');
    expect(result.dryRun).toBe(true);
    expect(result.source).toBe('geojson');
    expect(result.dedupePolicy).toBe('merge');
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      name: 'A',
      latitude: 53.9,
      longitude: 27.56,
      color: 'brown',
      status: 'planned',
      categoryIds: ['1'],
    });
    expect(result.summary).toMatchObject({ totalParsed: 1, valid: 1, warnings: ['w'], errors: [] });
  });

  it('normalizes an empty/invalid response defensively', async () => {
    mockUploadFormData.mockResolvedValue({});
    const webFile = new File(['{}'], 'p.geojson', { type: 'application/geo+json' });
    const result = await userPointsApi.previewImport({ uri: 'x', name: 'p.geojson', file: webFile } as any);

    expect(result.points).toEqual([]);
    expect(result.summary.totalParsed).toBe(0);
    expect(result.dedupePolicy).toBe('merge');
  });
});
