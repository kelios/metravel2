const mockPlatform = { OS: 'android' };
const mockManipulateAsync = jest.fn();
const mockManipulatorFactory = jest.fn(() => ({
  manipulateAsync: mockManipulateAsync,
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockReactNativeFactory = jest.fn(() => ({ Platform: mockPlatform }));

jest.mock('expo-image-manipulator', () => mockManipulatorFactory());
jest.mock('react-native', () => mockReactNativeFactory());

describe('imageCompressor platform contract', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///compressed.jpg', width: 1920, height: 1280 });
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
  });

  it('compresses avatars on native with the existing size and quality', async () => {
    const { compressAvatar } = require('@/utils/imageCompressor.ts');
    expect(await compressAvatar('file:///avatar.jpg')).toEqual({
      uri: 'file:///compressed.jpg', width: 1920, height: 1280,
    });
    expect(mockManipulatorFactory).toHaveBeenCalledTimes(1);
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///avatar.jpg', [
      { resize: { width: 512, height: 512 } },
    ], { compress: 0.85, format: 'jpeg' });
  });

  it('compresses travel photos on native with the existing size and quality', async () => {
    const { compressTravelPhoto } = require('@/utils/imageCompressor.ts');
    const result = await compressTravelPhoto('file:///photo.jpg');
    expect(result).toEqual({ uri: 'file:///compressed.jpg', width: 1920, height: 1280 });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///photo.jpg', [
      { resize: { width: 1920, height: 1920 } },
    ], { compress: 0.8, format: 'jpeg' });
  });

  it('preserves the native squareCrop option and custom compression quality', async () => {
    mockPlatform.OS = 'ios';
    const { compressImage } = require('@/utils/imageCompressor.ts');
    await compressImage('file:///photo.jpg', { squareCrop: true, quality: 0.6, maxDimension: 100 });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///photo.jpg', [
      { resize: { width: 512, height: 512 } },
    ], { compress: 0.6, format: 'jpeg' });
  });

  it('preserves the native original-URI fallback when manipulation rejects', async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error('decoder unavailable'));
    const { compressImage } = require('@/utils/imageCompressor.ts');
    expect(await compressImage('file:///photo.jpg')).toEqual({ uri: 'file:///photo.jpg', width: 0, height: 0 });
  });
});

