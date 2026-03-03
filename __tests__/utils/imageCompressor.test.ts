// __tests__/utils/imageCompressor.test.ts
// AND-15: Tests for image compression utility.

import { Platform } from 'react-native';

describe('imageCompressor', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    // @ts-ignore
    Platform.OS = originalPlatform;
    jest.resetModules();
  });

  it('returns original URI on web', async () => {
    // @ts-ignore
    Platform.OS = 'web';

    // Re-import to get web behavior
    jest.resetModules();
    const { compressImage } = require('@/utils/imageCompressor');

    const result = await compressImage('file:///test.jpg');
    expect(result.uri).toBe('file:///test.jpg');
  });

  it('compressAvatar returns compressed result on native', async () => {
    // @ts-ignore
    Platform.OS = 'android';

    jest.resetModules();
    const { compressAvatar } = require('@/utils/imageCompressor');

    const result = await compressAvatar('file:///avatar.jpg');
    // The mock returns the same URI with dimensions
    expect(result.uri).toBeTruthy();
    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
  });

  it('compressTravelPhoto returns compressed result on native', async () => {
    // @ts-ignore
    Platform.OS = 'android';

    jest.resetModules();
    const { compressTravelPhoto } = require('@/utils/imageCompressor');

    const result = await compressTravelPhoto('file:///photo.jpg');
    expect(result.uri).toBeTruthy();
  });

  it('compressImage with squareCrop option', async () => {
    // @ts-ignore
    Platform.OS = 'ios';

    jest.resetModules();
    const { compressImage } = require('@/utils/imageCompressor');

    const result = await compressImage('file:///photo.jpg', { squareCrop: true });
    expect(result.uri).toBeTruthy();
  });
});

