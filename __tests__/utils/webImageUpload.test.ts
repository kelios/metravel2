import {
  isHeicLikeFile,
  prepareWebImageFileForUpload,
  HeicConversionError,
} from '@/utils/webImageUpload';

const mockHeicTo = jest.fn(async () => new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }));

jest.mock('heic-to', () => ({
  __esModule: true,
  heicTo: (...args: unknown[]) => mockHeicTo(...args),
}));

describe('webImageUpload', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalImage = global.Image;
  const originalDocumentCreateElement = document.createElement.bind(document);

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.Image = originalImage;
    jest.restoreAllMocks();
  });

  it('detects HEIC by mime type and extension', () => {
    expect(isHeicLikeFile(new File(['a'], 'iphone.heic', { type: 'image/heic' }))).toBe(true);
    expect(isHeicLikeFile(new File(['a'], 'iphone.heif', { type: '' }))).toBe(true);
    expect(isHeicLikeFile(new File(['a'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('converts HEIC to JPEG file for upload', async () => {
    const source = new File([new Uint8Array([1, 2, 3])], 'iphone.heic', { type: 'image/heic' });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted).not.toBe(source);
    expect(converted.type).toBe('image/jpeg');
    expect(converted.name).toBe('iphone.jpg');
  });

  it('leaves non-HEIC files unchanged', async () => {
    const source = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBe(source);
  });

  it('compresses oversized web JPEGs before upload validation', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:test-large-photo');
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 5712;
      naturalHeight = 4284;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }

    global.Image = MockImage as unknown as typeof Image;

    const createElementSpy = jest.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') {
        return originalDocumentCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
          expect(type).toBe('image/jpeg');
          expect(quality).toBeLessThan(1);
          callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
        },
      } as unknown as HTMLCanvasElement;
    });

    const source = new File([new Uint8Array(10 * 1024 * 1024 + 128)], 'waterfall.JPG', {
      type: 'image/jpeg',
    });

    const converted = await prepareWebImageFileForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted).not.toBe(source);
    expect(converted.name).toBe('waterfall.jpg');
    expect(converted.type).toBe('image/jpeg');
    expect(converted.size).toBeLessThan(source.size);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-large-photo');
  });

  it('throws HeicConversionError instead of returning the raw HEIC when decode fails', async () => {
    mockHeicTo.mockRejectedValueOnce(new Error('ERR_LIBHEIF format not supported'));
    const source = new File([new Uint8Array([1, 2, 3])], 'iphone.heic', { type: 'image/heic' });

    await expect(prepareWebImageFileForUpload(source)).rejects.toBeInstanceOf(HeicConversionError);
  });
});
