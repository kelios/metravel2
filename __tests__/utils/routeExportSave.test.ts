import { Platform } from 'react-native';

import { saveRouteExportFile } from '@/utils/routeExport';

jest.mock('@/utils/routeExport/download', () => ({
  downloadTextFileWeb: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const { downloadTextFileWeb } = require('@/utils/routeExport/download');
const FileSystem = require('expo-file-system/legacy');
const Sharing = require('expo-sharing');

describe('saveRouteExportFile', () => {
  const originalOS = Platform.OS;
  const file = {
    filename: 'metravel-points.kml',
    content: '<kml/>',
    mimeType: 'application/vnd.google-earth.kml+xml',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    downloadTextFileWeb.mockReturnValue(true);
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
  });

  it('web: delegates to browser download', async () => {
    (Platform as { OS: string }).OS = 'web';

    await expect(saveRouteExportFile(file)).resolves.toBe(true);

    expect(downloadTextFileWeb).toHaveBeenCalledWith(file);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('android: writes the generated file to cache and opens the native share sheet', async () => {
    (Platform as { OS: string }).OS = 'android';

    await expect(saveRouteExportFile(file, 'Сохранить точки')).resolves.toBe(true);

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/metravel-points.kml', '<kml/>');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/metravel-points.kml',
      expect.objectContaining({
        mimeType: 'application/vnd.google-earth.kml+xml',
        dialogTitle: 'Сохранить точки',
      }),
    );
  });
});
