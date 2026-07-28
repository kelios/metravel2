import { act, renderHook } from '@testing-library/react-native';

const mockDownloadTileToDisk = jest.fn();
const mockRegisterRegion = jest.fn();
const mockDeleteRegion = jest.fn();
const mockDeleteDownloadedTiles = jest.fn();
const mockFetchOfflineMapPoints = jest.fn();
const mockSaveMapRegionOffline = jest.fn();

jest.mock('@/config/mapWebLayers', () => ({
  getThemedNativeBaseTileUrl: () => 'https://tiles.test/{z}/{x}/{y}.png',
}));
jest.mock('@/i18n', () => ({ translate: () => 'Область карты' }));
jest.mock('@/api/mapOffline', () => ({
  fetchOfflineMapPoints: (...args: unknown[]) => mockFetchOfflineMapPoints(...args),
}));
jest.mock('@/services/offline/mapOfflineAdapter', () => ({
  saveMapRegionOffline: (...args: unknown[]) => mockSaveMapRegionOffline(...args),
}));
jest.mock('@/utils/mapTileCache', () => ({
  AVG_TILE_BYTES: 1024,
  enumerateTiles: () => [{ z: 10, x: 1, y: 2 }, { z: 10, x: 1, y: 3 }],
  estimateTiles: () => 2,
  planOfflineZoomRange: () => ({ minZ: 10, maxZ: 10, tileCount: 2 }),
  downloadTileToDisk: (...args: unknown[]) => mockDownloadTileToDisk(...args),
  registerRegion: (...args: unknown[]) => mockRegisterRegion(...args),
  deleteRegion: (...args: unknown[]) => mockDeleteRegion(...args),
  deleteDownloadedTiles: (...args: unknown[]) => mockDeleteDownloadedTiles(...args),
}));

import { useOfflineTileDownload } from '@/hooks/map/useOfflineTileDownload';

const bbox = { west: 27.4, south: 53.8, east: 27.7, north: 54 };

describe('useOfflineTileDownload atomic package', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOfflineMapPoints.mockResolvedValue({ points: [{ id: 1 }], etag: 'v1' });
    mockRegisterRegion.mockResolvedValue(undefined);
    mockDeleteRegion.mockResolvedValue(undefined);
    mockDeleteDownloadedTiles.mockResolvedValue(undefined);
    mockSaveMapRegionOffline.mockResolvedValue(undefined);
  });

  it('does not register a partial region when one tile fails', async () => {
    mockDownloadTileToDisk.mockResolvedValueOnce(100).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useOfflineTileDownload());

    await act(async () => result.current.downloadCurrentRegion(bbox, { minZ: 10, maxZ: 10 }));

    expect(result.current.state).toBe('error');
    expect(mockRegisterRegion).not.toHaveBeenCalled();
    expect(mockSaveMapRegionOffline).not.toHaveBeenCalled();
    expect(mockDeleteDownloadedTiles).toHaveBeenCalledWith([{ z: 10, x: 1, y: 2 }]);
  });

  it('publishes the catalog entry only after every tile succeeds', async () => {
    mockDownloadTileToDisk.mockResolvedValue(120);
    const { result } = renderHook(() => useOfflineTileDownload());

    await act(async () => result.current.downloadCurrentRegion(bbox, { minZ: 10, maxZ: 10 }));

    expect(result.current.state).toBe('done');
    expect(mockRegisterRegion).toHaveBeenCalledWith(expect.objectContaining({
      bbox,
      tileCount: 2,
      bytes: 240,
    }));
    expect(mockSaveMapRegionOffline).toHaveBeenCalledWith(
      expect.objectContaining({ tileCount: 2 }),
      [{ id: 1 }],
      'v1',
    );
  });

  it('rolls back tiles and registry when catalog persistence fails', async () => {
    mockDownloadTileToDisk.mockResolvedValue(120);
    mockSaveMapRegionOffline.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useOfflineTileDownload());

    await act(async () => result.current.downloadCurrentRegion(bbox, { minZ: 10, maxZ: 10 }));

    expect(result.current.state).toBe('error');
    expect(mockDeleteRegion).toHaveBeenCalled();
    expect(mockDeleteDownloadedTiles).toHaveBeenCalled();
  });
});
