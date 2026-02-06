import { extractGpsFromImageFile } from '@/utils/exifGps';

jest.mock('exifr', () => ({
  gps: jest.fn(),
}));

const exifr = jest.requireMock('exifr') as { gps: jest.Mock };

describe('extractGpsFromImageFile', () => {
  test('returns lat/lng when GPS exists', async () => {
    exifr.gps.mockResolvedValueOnce({ latitude: 52.5, longitude: 13.4 });
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(extractGpsFromImageFile(file)).resolves.toEqual({ lat: 52.5, lng: 13.4 });
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

