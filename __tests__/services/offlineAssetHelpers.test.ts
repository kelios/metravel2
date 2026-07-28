const mockDownload = jest.fn();
const mockRemove = jest.fn();

jest.mock('@/services/offline/offlineAssets', () => ({
  __esModule: true,
  default: {
    download: (...args: unknown[]) => mockDownload(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

import {
  collectOfflineAssetSources,
  downloadAndRewriteOfflineAssets,
} from '@/services/offline/offlineAssetHelpers';

describe('offline asset packaging', () => {
  beforeEach(() => jest.clearAllMocks());

  it('collects media URLs and rewrites the snapshot to durable URIs', async () => {
    const snapshot = {
      coverImage: 'https://metravel.by/gallery/cover.webp',
      description: '<p>Фото <img src="https://metravel.by/gallery/body.jpg"></p>',
    };
    const sources = collectOfflineAssetSources(snapshot);
    expect(sources.map((item) => item.id)).toEqual(expect.arrayContaining([
      'https://metravel.by/gallery/cover.webp',
      'https://metravel.by/gallery/body.jpg',
    ]));
    mockDownload.mockImplementation(async (_key: string, values: Array<{ id: string }>) =>
      values.map((value, index) => ({ id: value.id, uri: `file:///offline/${index}.webp`, bytes: 10 })),
    );

    const packaged = await downloadAndRewriteOfflineAssets('travel:1', snapshot);

    expect(packaged.snapshot.coverImage).toMatch(/^file:\/\/\/offline\//);
    expect(packaged.snapshot.description).toContain('file:///offline/');
    expect(packaged.assets).toHaveLength(2);
  });

  it('rejects an incomplete asset set instead of publishing a partial package', async () => {
    mockDownload.mockResolvedValue([]);
    await expect(downloadAndRewriteOfflineAssets('travel:1', {
      coverImage: 'https://metravel.by/gallery/cover.webp',
    })).rejects.toThrow('OFFLINE_ASSET_SET_INCOMPLETE');
    expect(mockRemove).toHaveBeenCalledWith([]);
  });
});
