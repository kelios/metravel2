import JSZip from 'jszip';
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
    } finally {
      (global as any).fetch = previousFetch;
    }
  });

  it('converts KMZ from DocumentPickerAsset.file without fetching blob uri', async () => {
    const previousFetch = (global as any).fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    try {
      const zip = new JSZip();
      zip.file(
        'doc.kml',
        '<?xml version="1.0" encoding="UTF-8"?><kml><Document><Placemark><name>Test</name><Point><coordinates>30.5,50.4,0</coordinates></Point></Placemark></Document></kml>'
      );
      const content = await zip.generateAsync({ type: 'arraybuffer' });
      const kmzFile = {
        name: 'Saved Places.kmz',
        arrayBuffer: jest.fn().mockResolvedValue(content),
      };
      const asset = {
        uri: 'blob:https://metravel.by/test',
        name: 'Saved Places.kmz',
        file: kmzFile,
      };

      await userPointsApi.importPoints(asset as any);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockUploadFormData).toHaveBeenCalledTimes(1);
      const formData = mockUploadFormData.mock.calls[0][1] as FormData;
      const uploadedFile = formData.get('file') as File;
      expect(uploadedFile).toBeInstanceOf(File);
      expect(uploadedFile.name).toBe('Saved Places.kml');
      expect(kmzFile.arrayBuffer).toHaveBeenCalledTimes(1);
    } finally {
      (global as any).fetch = previousFetch;
    }
  });
});
