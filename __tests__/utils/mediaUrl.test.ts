import { normalizeMediaUrl, toLegacyResizePath } from '@/utils/mediaUrl';

describe('normalizeMediaUrl', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeMediaUrl(null)).toBe('');
    expect(normalizeMediaUrl(undefined)).toBe('');
    expect(normalizeMediaUrl('')).toBe('');
    expect(normalizeMediaUrl('   ')).toBe('');
  });

  it('returns data: URIs as-is', () => {
    const dataUri = 'data:image/png;base64,abc123';
    expect(normalizeMediaUrl(dataUri)).toBe(dataUri);
  });

  it('returns blob: URIs as-is', () => {
    const blobUri = 'blob:http://localhost/abc';
    expect(normalizeMediaUrl(blobUri)).toBe(blobUri);
  });

  it('returns absolute http URLs as-is', () => {
    const url = 'https://cdn.example.com/img.jpg';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('rewrites private absolute media URLs through the configured API origin', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api';
    try {
      expect(
        normalizeMediaUrl('http://192.168.50.36/quest-cover/quests/8/main/cover.png?version=2'),
      ).toBe('https://metravel.by/quest-cover/quests/8/main/cover.png?version=2');
    } finally {
      process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('fixes malformed double-host absolute URLs', () => {
    const url =
      'http://192.168.50.36https://metravellocal.s3.amazonaws.com/quests/5/poster/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test';

    expect(normalizeMediaUrl(url)).toBe(
      'https://metravellocal.s3.amazonaws.com/quests/5/poster/video.mp4',
    );
  });

  it('does not break valid urls with https in query params', () => {
    const url = 'https://example.com/video?redirect=https://other.com';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('prefixes relative URLs with API host', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.50.36';
    try {
      expect(normalizeMediaUrl('/uploads/photo.jpg')).toBe(
        'http://192.168.50.36/uploads/photo.jpg',
      );
    } finally {
      process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('strips /api suffix from base when prefixing', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'http://host.com/api';
    try {
      expect(normalizeMediaUrl('/media/img.jpg')).toBe(
        'http://host.com/media/img.jpg',
      );
    } finally {
      process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('adds slash between prefix and relative path without leading slash', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'http://host.com';
    try {
      expect(normalizeMediaUrl('uploads/img.jpg')).toBe(
        'http://host.com/uploads/img.jpg',
      );
    } finally {
      process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('trims whitespace from input', () => {
    expect(normalizeMediaUrl('  https://cdn.com/x.jpg  ')).toBe('https://cdn.com/x.jpg');
  });

  it('upgrades insecure metravel absolute urls to https', () => {
    expect(normalizeMediaUrl('http://metravel.by/address-image/123/file.jpg')).toBe(
      'https://metravel.by/address-image/123/file.jpg',
    );
    expect(normalizeMediaUrl('http://cdn.metravel.by/travel-image/1/photo.jpg')).toBe(
      'https://cdn.metravel.by/travel-image/1/photo.jpg',
    );
  });
});

// #1176: прямая ссылка на бакет не понимает `w` и отдаёт мастер. Маршруты берутся
// из `route_behavior` в `GET /api/media/proxy-contract` (v4): `legacy_upload`
// обслуживает `uploads/**`, `legacy_conversion` — `**/conversions/**`.
describe('toLegacyResizePath', () => {
  it('routes a legacy uploads key to the first-party resize route', () => {
    expect(
      toLegacyResizePath(
        'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg',
      ),
    ).toBe('/media-resize/uploads/1591620319350_original.jpg');
  });

  it('routes a legacy conversions key to the legacy resize route', () => {
    expect(
      toLegacyResizePath(
        'https://metravelprod.s3.eu-north-1.amazonaws.com/3994/conversions/HcQK-detail_hd.jpg',
      ),
    ).toBe('/media-resize/legacy/3994/conversions/HcQK-detail_hd.jpg');
  });

  it('accepts path-style and region-less bucket hosts', () => {
    expect(
      toLegacyResizePath('https://s3.eu-north-1.amazonaws.com/metravelprod/uploads/photo.jpg'),
    ).toBe('/media-resize/uploads/photo.jpg');
    expect(
      toLegacyResizePath('https://metravelprod.s3.amazonaws.com/uploads/photo.jpg'),
    ).toBe('/media-resize/uploads/photo.jpg');
  });

  it('drops S3 signature params but keeps the cache buster', () => {
    expect(
      toLegacyResizePath(
        'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/photo.jpg?v=42&X-Amz-Signature=abc&X-Amz-Expires=60',
      ),
    ).toBe('/media-resize/uploads/photo.jpg?v=42');
  });

  it('does not invent a route for bucket classes that have none', () => {
    // `**/responsive-images/**` удалён целиком в #1157, плоский корень живёт под
    // family-роутами: переписывать их некуда, и молча ломать ссылку нельзя.
    expect(
      toLegacyResizePath(
        'https://metravelprod.s3.eu-north-1.amazonaws.com/540/responsive-images/x.jpg',
      ),
    ).toBeNull();
    expect(
      toLegacyResizePath('https://metravelprod.s3.eu-north-1.amazonaws.com/abc123.webp'),
    ).toBeNull();
  });

  it('leaves foreign buckets and non-storage urls alone', () => {
    expect(
      toLegacyResizePath('https://other-bucket.s3.eu-north-1.amazonaws.com/uploads/photo.jpg'),
    ).toBeNull();
    expect(toLegacyResizePath('https://metravel.by/gallery/1/photo.webp')).toBeNull();
    expect(toLegacyResizePath('https://example.com/uploads/photo.jpg')).toBeNull();
    expect(toLegacyResizePath('')).toBeNull();
  });
});
