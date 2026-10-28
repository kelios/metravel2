import { Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

import { usePointsExportKml } from '@/components/UserPoints/usePointsExportKml';

jest.mock('@/api/userPoints', () => ({
  userPointsApi: { exportKml: jest.fn() },
}));
jest.mock('@/utils/downloadUrlOnWeb', () => ({
  downloadBlobOnWeb: jest.fn(() => true),
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const { userPointsApi } = require('@/api/userPoints');
const { downloadBlobOnWeb } = require('@/utils/downloadUrlOnWeb');
const FileSystem = require('expo-file-system/legacy');
const Sharing = require('expo-sharing');

const kmlBlob = (contents: string) => {
  const blob = new Blob([contents], { type: 'application/vnd.google-earth.kml+xml' });
  if (typeof blob.text !== 'function') {
    Object.defineProperty(blob, 'text', { value: async () => contents });
  }
  return blob;
};

describe('usePointsExportKml', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
  });

  it('web: saves the KML blob through the shared download helper', async () => {
    (Platform as { OS: string }).OS = 'web';
    const blob = kmlBlob('<kml/>');
    userPointsApi.exportKml.mockResolvedValue({
      blob,
      filename: 'points.kml',
      contentType: 'application/vnd.google-earth.kml+xml',
    });

    const { result } = await renderHook(() => usePointsExportKml());
    await act(async () => {
      await result.current.handleExportKml();
    });

    expect(downloadBlobOnWeb).toHaveBeenCalledWith(blob, 'points.kml');
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('android: writes the KML text and opens the share sheet', async () => {
    (Platform as { OS: string }).OS = 'android';
    Sharing.isAvailableAsync.mockResolvedValue(true);
    const blob = kmlBlob('<kml/>');
    userPointsApi.exportKml.mockResolvedValue({
      blob,
      filename: 'points.kml',
      contentType: 'application/vnd.google-earth.kml+xml',
    });

    const { result } = await renderHook(() => usePointsExportKml());
    await act(async () => {
      await result.current.handleExportKml();
    });

    expect(downloadBlobOnWeb).not.toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/points.kml', '<kml/>');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/points.kml',
      expect.objectContaining({
        mimeType: 'application/vnd.google-earth.kml+xml',
      }),
    );
  });
});
