import { normalizeMediaUrl } from '@/utils/mediaUrl';

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
});
