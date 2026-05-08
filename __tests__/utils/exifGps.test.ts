import { extractGpsFromImageFile } from '@/utils/exifGps';

jest.mock('exifr/dist/lite.esm.mjs', () => ({
  __esModule: true,
  gps: jest.fn(),
  default: {
    gps: jest.fn(),
  },
  fileParsers: new Map([
    ['heic', class MockHeicParser {
      static canHandle() {
        return false;
      }
    }],
  ]),
}));

const exifr = jest.requireMock('exifr/dist/lite.esm.mjs') as {
  gps: jest.Mock;
  default: { gps: jest.Mock };
  fileParsers: Map<string, { canHandle?: (fileView: unknown, firstTwoBytes: number) => boolean }>;
};

describe('extractGpsFromImageFile', () => {
  beforeEach(() => {
    exifr.gps.mockReset();
    exifr.default.gps.mockImplementation(exifr.gps);
  });

  test('returns lat/lng when GPS exists', async () => {
    exifr.gps.mockResolvedValueOnce({ latitude: 52.5, longitude: 13.4 });
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(extractGpsFromImageFile(file)).resolves.toEqual({ lat: 52.5, lng: 13.4 });
  });

  test('patches HEIC parser detection for iPhone-compatible brand variants', async () => {
    exifr.gps.mockResolvedValueOnce({ latitude: 39.68555833333333, longitude: 45.23131666666667 });
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.HEIC', { type: 'image/heic' });

    await expect(extractGpsFromImageFile(file)).resolves.toEqual({
      lat: 39.68555833333333,
      lng: 45.23131666666667,
    });

    const patchedHeicParser = exifr.fileParsers.get('patched-heic');
    expect(typeof patchedHeicParser).toBe('function');
    expect(
      patchedHeicParser?.canHandle?.({
        byteLength: 52,
        getUint32: (offset: number) => (offset === 0 ? 52 : 0),
        getString: (offset: number) =>
          ({
            4: 'ftyp',
            8: 'heic',
            16: 'mif1',
            20: 'MiHB',
            24: 'MiHA',
            28: 'heix',
          } as Record<number, string>)[offset] ?? '',
      }, 0),
    ).toBe(true);
  });

  test('returns null when GPS missing', async () => {
    exifr.gps.mockResolvedValueOnce(null);
    const file = new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(extractGpsFromImageFile(file)).resolves.toBeNull();
  });

  test('returns null when GPS out of range', async () => {
    exifr.gps.mockResolvedValueOnce({ latitude: 200, longitude: 13.4 });
    const file = new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(extractGpsFromImageFile(file)).resolves.toBeNull();
  });

  test('returns null on parser error', async () => {
    exifr.gps.mockRejectedValueOnce(new Error('boom'));
    const file = new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(extractGpsFromImageFile(file)).resolves.toBeNull();
  });
});
