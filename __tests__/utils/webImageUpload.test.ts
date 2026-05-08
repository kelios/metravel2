import { isHeicLikeFile, prepareWebImageFileForUpload } from '@/utils/webImageUpload';

jest.mock('heic2any', () => ({
  __esModule: true,
  default: jest.fn(async () => new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' })),
}));

describe('webImageUpload', () => {
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
});
