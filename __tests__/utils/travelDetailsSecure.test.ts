/**
 * Security tests for travelDetailsSecure utilities
 * Tests cover XSS prevention, URL validation, and data sanitization
 */

import {
  validateYoutubeId,
  safeGetYoutubeId,
  stripHtml,
  createSafeImageUrl,
  getSafeOrigin,
  createSafeJsonLd,
  isSafePreconnectDomain,
  isWhitelistedOrigin,
  SAFE_PRECONNECT_DOMAINS,
} from '@/utils/travelDetailsSecure';

describe('travelDetailsSecure', () => {
  describe('validateYoutubeId', () => {
    it('should accept valid YouTube ID', () => {
      expect(validateYoutubeId('dQw4w9WgXcQ')).toBe(true);
      expect(validateYoutubeId('9bZkp7q19f0')).toBe(true);
    });

    it('should reject non-11-char IDs', () => {
      expect(validateYoutubeId('short')).toBe(false);
      expect(validateYoutubeId('thisistoolongforaid')).toBe(false);
      expect(validateYoutubeId('')).toBe(false);
    });

    it('should reject IDs with invalid characters', () => {
      expect(validateYoutubeId('dQw4w9WgXc!')).toBe(false);
      expect(validateYoutubeId('dQw4w9WgXc@')).toBe(false);
      expect(validateYoutubeId('dQw4w9Wg\x00cQ')).toBe(false);
    });

    it('should reject IDs with consecutive special characters', () => {
      expect(validateYoutubeId('dQw4w9Wg--Q')).toBe(false);
      expect(validateYoutubeId('dQw4w9Wg__Q')).toBe(false);
      expect(validateYoutubeId('dQw4w9W-_cQ')).toBe(false);
    });
  });

  describe('safeGetYoutubeId', () => {
    it('should extract ID from youtube.com URL', () => {
      expect(safeGetYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
        .toBe('dQw4w9WgXcQ');
      expect(safeGetYoutubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=10'))
        .toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from youtu.be short URL', () => {
      expect(safeGetYoutubeId('https://youtu.be/dQw4w9WgXcQ'))
        .toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from embed URL', () => {
      expect(safeGetYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'))
        .toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from shorts URL', () => {
      expect(safeGetYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'))
        .toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URLs', () => {
      expect(safeGetYoutubeId('https://example.com')).toBe(null);
      expect(safeGetYoutubeId('not a url')).toBe(null);
    });

    it('should return null for malformed YouTube IDs', () => {
      expect(safeGetYoutubeId('https://www.youtube.com/watch?v=tooshort'))
        .toBe(null);
      expect(safeGetYoutubeId('https://www.youtube.com/watch?v=has!invalid@chars'))
        .toBe(null);
    });

    it('should return null for null/undefined input', () => {
      expect(safeGetYoutubeId(null)).toBe(null);
      expect(safeGetYoutubeId(undefined)).toBe(null);
    });

    it('should return null for very long URLs', () => {
      const longUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' + 'x'.repeat(2000);
      expect(safeGetYoutubeId(longUrl)).toBe(null);
    });

    it('should sanitize control characters from URL', () => {
      // Control character in the query string parameter value should be removed
      const urlWithControlChars = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ\x00';
      expect(safeGetYoutubeId(urlWithControlChars)).toBe('dQw4w9WgXcQ');
    });
  });

  describe('stripHtml', () => {
    it('should strip HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).toBe('Hello');
      expect(stripHtml('<div><span>Hello World</span></div>'))
        .toBe('Hello World');
    });

    it('should sanitize script tags', () => {
      expect(stripHtml('<script>alert("xss")</script>Hello'))
        .toBe('Hello');
    });

    it('should sanitize event handlers', () => {
      expect(stripHtml('<div onclick="alert(1)">Click</div>'))
        .toContain('Click');
    });

    it('should decode HTML entities', () => {
      expect(stripHtml('Hello &amp; goodbye')).toBe('Hello & goodbye');
      expect(stripHtml('Quote &quot;test&quot;')).toBe('Quote "test"');
    });

    it('should handle null/undefined', () => {
      const fallback = 'Найди место для путешествия и поделись своим опытом.';
      expect(stripHtml(null)).toBe(fallback);
      expect(stripHtml(undefined)).toBe(fallback);
    });

    it('should trim whitespace', () => {
      expect(stripHtml('  Hello  World  ')).toBe('Hello World');
      expect(stripHtml('<p>  Multiple   spaces  </p>'))
        .toBe('Multiple spaces');
    });

    it('should return default message if empty after stripping', () => {
      expect(stripHtml('<script></script>')).toContain('путешествия');
    });
  });

  describe('createSafeImageUrl', () => {
    it('should return empty string for missing URL', () => {
      expect(createSafeImageUrl(undefined)).toBe('');
      expect(createSafeImageUrl(null as any)).toBe('');
      expect(createSafeImageUrl('')).toBe('');
    });

    it('should convert http to https', () => {
      const result = createSafeImageUrl('http://example.com/image.jpg');
      expect(result).toContain('https://');
      expect(result).not.toContain('http://example.com');
    });

    it('should reject path traversal attempts', () => {
      expect(createSafeImageUrl('https://example.com/../../../etc/passwd'))
        .toBe('');
      expect(createSafeImageUrl('https://example.com//..\\image.jpg'))
        .toBe('');
    });

    it('should add version parameter if provided', () => {
      const result = createSafeImageUrl(
        'https://example.com/image.jpg',
        '2025-12-29T10:00:00Z',
        123
      );
      expect(result).toContain('v=');
    });

    it('should only allow http/https protocols', () => {
      expect(createSafeImageUrl('ftp://example.com/image.jpg')).toBe('');
      expect(createSafeImageUrl('javascript:alert(1)')).toBe('');
      expect(createSafeImageUrl('data:image/jpeg,base64')).toBe('');
    });

    it('should handle invalid URLs gracefully', () => {
      expect(createSafeImageUrl('not a valid url')).toBe('');
      expect(createSafeImageUrl('ht!tp://invalid')).toBe('');
    });
  });

  describe('getSafeOrigin', () => {
    it('should extract origin from valid URL', () => {
      expect(getSafeOrigin('https://example.com/path')).toBe('https://example.com');
      expect(getSafeOrigin('https://api.example.com:8080/v1'))
        .toBe('https://api.example.com:8080');
    });

    it('should convert http to https', () => {
      expect(getSafeOrigin('http://example.com')).toBe('https://example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(getSafeOrigin('not a url')).toBe(null);
      expect(getSafeOrigin('javascript:alert(1)')).toBe(null);
    });

    it('should reject path traversal in origin', () => {
      expect(getSafeOrigin('https://example.com/../../../')).toBe(null);
    });

    it('should only allow http/https', () => {
      expect(getSafeOrigin('ftp://example.com')).toBe(null);
      expect(getSafeOrigin('file:///etc/passwd')).toBe(null);
    });

    it('should return null for null/undefined', () => {
      expect(getSafeOrigin(null as any)).toBe(null);
      expect(getSafeOrigin(undefined)).toBe(null);
    });
  });

  describe('createSafeJsonLd', () => {
    it('should return null for missing travel', () => {
      expect(createSafeJsonLd(null)).toBe(null);
      expect(createSafeJsonLd(undefined)).toBe(null);
    });

    it('should create valid JSON-LD structure', () => {
      const travel = {
        name: 'Minsk City Tour',
        description: '<p>Explore Minsk</p>',
        slug: 'minsk-city-tour',
        gallery: ['https://example.com/image.jpg'],
      } as any;

      const result = createSafeJsonLd(travel);

      expect(result).toHaveProperty('@context', 'https://schema.org');
      expect(result).toHaveProperty('@type', 'Article');
      expect(result).toHaveProperty('headline', 'Minsk City Tour');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('url');
    });

    it('should sanitize description HTML', () => {
      const travel = {
        name: 'Test',
        description: '<script>alert(1)</script>Safe content',
        slug: 'test',
        gallery: [],
      } as any;

      const result = createSafeJsonLd(travel);
      expect(result?.description).not.toContain('<script>');
      expect(result?.description).toContain('Safe content');
    });

    it('should validate slug format', () => {
      const travel = {
        name: 'Test',
        description: 'Test',
        slug: 'test-slug-123',
        gallery: [],
      } as any;

      const result = createSafeJsonLd(travel);
      expect(result?.url).toContain('test-slug-123');
    });

    it('should reject invalid slug format', () => {
      const travel = {
        name: 'Test',
        description: 'Test',
        slug: 'test/../../malicious',
        gallery: [],
      } as any;

      const result = createSafeJsonLd(travel);
      expect(result?.url).toBeUndefined();
    });

    it('should limit field lengths', () => {
      const travel = {
        name: 'x'.repeat(300),
        description: 'y'.repeat(600),
        slug: 'test',
        gallery: [],
      } as any;

      const result = createSafeJsonLd(travel);
      expect(result?.headline.length).toBeLessThanOrEqual(200);
      expect(result?.description.length).toBeLessThanOrEqual(500);
    });
  });

  describe('isSafePreconnectDomain', () => {
    it('should accept whitelisted domains', () => {
      expect(isSafePreconnectDomain('https://maps.googleapis.com')).toBe(true);
      expect(isSafePreconnectDomain('https://img.youtube.com')).toBe(true);
      expect(isSafePreconnectDomain('https://api.metravel.by')).toBe(true);
    });

    it('should reject non-whitelisted domains', () => {
      expect(isSafePreconnectDomain('https://example.com')).toBe(false);
      expect(isSafePreconnectDomain('https://malicious.com')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isSafePreconnectDomain(null)).toBe(false);
      expect(isSafePreconnectDomain(undefined)).toBe(false);
    });

    it('should have properly defined whitelist', () => {
      expect(Array.isArray(SAFE_PRECONNECT_DOMAINS)).toBe(true);
      expect(SAFE_PRECONNECT_DOMAINS.length).toBeGreaterThan(0);
      SAFE_PRECONNECT_DOMAINS.forEach(domain => {
        expect(domain).toMatch(/^https:\/\//);
      });
    });
  });

  describe('isWhitelistedOrigin', () => {
    it('should accept origins from whitelisted domains', () => {
      expect(isWhitelistedOrigin('https://maps.googleapis.com')).toBe(true);
      expect(isWhitelistedOrigin('https://api.metravel.by')).toBe(true);
    });

    it('should reject non-whitelisted origins', () => {
      expect(isWhitelistedOrigin('https://example.com')).toBe(false);
      expect(isWhitelistedOrigin('https://malicious.com')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isWhitelistedOrigin(null)).toBe(false);
      expect(isWhitelistedOrigin(undefined)).toBe(false);
    });
  });

  describe('XSS Prevention Integration', () => {
    it('should prevent stored XSS via description', () => {
      const xssPayload = '<img src=x onerror="alert(\'xss\')">';
      const result = stripHtml(xssPayload);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('<img');
    });

    it('should prevent DOM-based XSS via URL', () => {
      const xssUrl = 'javascript:alert("xss")';
      const result = createSafeImageUrl(xssUrl);
      expect(result).toBe('');
    });

    it('should prevent path traversal attacks', () => {
      const traversal = 'https://example.com/../../../../etc/passwd';
      const result = createSafeImageUrl(traversal);
      expect(result).toBe('');
    });
  });
});

