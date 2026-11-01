const mockPlatform = { OS: 'android' };
const mockManipulateAsync = jest.fn();
const mockGetSize = jest.fn();
const mockManipulatorFactory = jest.fn(() => ({
  manipulateAsync: mockManipulateAsync,
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockReactNativeFactory = jest.fn(() => ({ Platform: mockPlatform, Image: { getSize: mockGetSize } }));

jest.mock('expo-image-manipulator', () => mockManipulatorFactory());
jest.mock('react-native', () => mockReactNativeFactory());

const resolveSize = (width: number, height: number) =>
  mockGetSize.mockImplementation((_uri: string, success?: (w: number, h: number) => void) => {
    if (typeof success === 'function') {
      success(width, height);
      return undefined;
    }
    return Promise.resolve({ width, height });
  });

describe('imageCompressor platform contract', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///compressed.jpg', width: 1920, height: 1280 });
    resolveSize(4000, 3000);
  });

  it.each(['file:///test.jpg', 'blob:preview-image', ''])('preserves %j and zero dimensions on web for every export', async (uri) => {
    const { compressImage, compressAvatar, compressTravelPhoto } = require('@/utils/imageCompressor.web.ts');
    const options = Object.freeze({ maxDimension: 128, quality: 0.1, squareCrop: true });
    for (const compress of [compressImage, compressAvatar, compressTravelPhoto]) {
      const result = compress(uri);
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toEqual({ uri, width: 0, height: 0 });
    }
    expect(await compressImage(uri, options)).toEqual({ uri, width: 0, height: 0 });
    expect(mockManipulatorFactory).not.toHaveBeenCalled();
    expect(mockManipulateAsync).not.toHaveBeenCalled();
    expect(mockReactNativeFactory).not.toHaveBeenCalled();
  });

  it('keeps the explicit base-module web fallback compatible without loading the SDK', async () => {
    mockPlatform.OS = 'web';
    const { compressImage } = require('@/utils/imageCompressor.ts');
    expect(await compressImage('file:///test.jpg')).toEqual({ uri: 'file:///test.jpg', width: 0, height: 0 });
    expect(mockManipulatorFactory).not.toHaveBeenCalled();
    expect(mockGetSize).not.toHaveBeenCalled();
  });

  it('crops avatars to a centered square and downsizes by one side only', async () => {
    const { compressAvatar } = require('@/utils/imageCompressor.ts');
    expect(await compressAvatar('file:///avatar.jpg')).toEqual({
      uri: 'file:///compressed.jpg', width: 1920, height: 1280,
    });
    expect(mockManipulatorFactory).toHaveBeenCalledTimes(1);
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///avatar.jpg', [
      { crop: { originX: 500, originY: 0, width: 3000, height: 3000 } },
      { resize: { width: 512 } },
    ], { compress: 0.85, format: 'jpeg' });
  });

  it('does not stretch an avatar when the source size is unknown', async () => {
    mockGetSize.mockImplementation((_uri: string, _success?: unknown, failure?: () => void) => {
      failure?.();
      return undefined;
    });
    const { compressAvatar } = require('@/utils/imageCompressor.ts');
    await compressAvatar('file:///avatar.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///avatar.jpg', [
      { resize: { width: 512 } },
    ], { compress: 0.85, format: 'jpeg' });
  });

  it('downsizes a landscape travel photo by width only, keeping the aspect ratio', async () => {
    const { compressTravelPhoto } = require('@/utils/imageCompressor.ts');
    const result = await compressTravelPhoto('file:///photo.jpg');
    expect(result).toEqual({ uri: 'file:///compressed.jpg', width: 1920, height: 1280 });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///photo.jpg', [
      { resize: { width: 1920 } },
    ], { compress: 0.8, format: 'jpeg' });
  });

  it('downsizes a portrait travel photo by height only', async () => {
    resolveSize(3000, 4000);
    const { compressTravelPhoto } = require('@/utils/imageCompressor.ts');
    await compressTravelPhoto('file:///portrait.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///portrait.jpg', [
      { resize: { height: 1920 } },
    ], { compress: 0.8, format: 'jpeg' });
  });

  it('only re-encodes a photo that already fits within the max dimension', async () => {
    resolveSize(1600, 1200);
    const { compressTravelPhoto } = require('@/utils/imageCompressor.ts');
    await compressTravelPhoto('file:///small.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///small.jpg', [], { compress: 0.8, format: 'jpeg' });
  });

  it('falls back to a width-only resize when the size cannot be read', async () => {
    mockGetSize.mockImplementation(() => Promise.reject(new Error('no decoder')));
    const { compressTravelPhoto } = require('@/utils/imageCompressor.ts');
    await compressTravelPhoto('file:///photo.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///photo.jpg', [
      { resize: { width: 1920 } },
    ], { compress: 0.8, format: 'jpeg' });
  });

  it('never passes both width and height to resize', () => {
    const { buildResizeActions } = require('@/utils/imageCompressor.ts');
    const cases = [
      [null, { maxDimension: 1920, squareCrop: false }],
      [null, { maxDimension: 512, squareCrop: true }],
      [{ width: 4000, height: 3000 }, { maxDimension: 1920, squareCrop: false }],
      [{ width: 3000, height: 4000 }, { maxDimension: 1920, squareCrop: false }],
      [{ width: 3000, height: 4000 }, { maxDimension: 512, squareCrop: true }],
      [{ width: 400, height: 400 }, { maxDimension: 512, squareCrop: true }],
    ] as const;
    for (const [size, options] of cases) {
      for (const action of buildResizeActions(size, options)) {
        if (!action.resize) continue;
        const resize = action.resize as { width?: number; height?: number };
        expect(resize.width != null && resize.height != null).toBe(false);
      }
    }
    expect(buildResizeActions({ width: 400, height: 400 }, { maxDimension: 512, squareCrop: true })).toEqual([]);
  });

  it('preserves the native squareCrop option and custom compression quality', async () => {
    mockPlatform.OS = 'ios';
    resolveSize(1000, 1000);
    const { compressImage } = require('@/utils/imageCompressor.ts');
    await compressImage('file:///photo.jpg', { squareCrop: true, quality: 0.6, maxDimension: 100 });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///photo.jpg', [
      { resize: { width: 512 } },
    ], { compress: 0.6, format: 'jpeg' });
  });

  it('preserves the native original-URI fallback when manipulation rejects', async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error('decoder unavailable'));
    const { compressImage } = require('@/utils/imageCompressor.ts');
    expect(await compressImage('file:///photo.jpg')).toEqual({ uri: 'file:///photo.jpg', width: 0, height: 0 });
  });
});
