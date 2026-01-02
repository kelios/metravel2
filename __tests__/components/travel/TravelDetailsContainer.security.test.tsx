/**
 * Comprehensive test suite for TravelDetailsContainer
 * Tests security, performance, accessibility, and cross-platform compatibility
 */

import {
  validateYoutubeId,
  safeGetYoutubeId,
  createSafeJsonLd,
  stripHtml,
  createSafeImageUrl,
  getSafeOrigin,
  isSafePreconnectDomain,
} from '@/utils/travelDetailsSecure';
import type { Travel } from '@/src/types/types';

const baseTravel: Travel = {
  id: 1,
  slug: 'test-travel',
  name: 'Test Travel',
  travel_image_thumb_url: 'https://cdn.example.com/thumb.jpg',
  travel_image_thumb_small_url: 'https://cdn.example.com/thumb-small.jpg',
  url: 'https://cdn.example.com/full.jpg',
  youtube_link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  userName: 'Tester',
  description: '<p>A test travel description</p>',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'City',
  countryName: 'Country',
  countUnicIpView: '0',
  gallery: ['https://example.com/image.jpg'],
  travelAddress: [],
  userIds: '',
  year: '2025',
  monthName: 'January',
  number_days: 1,
  companions: [],
  countryCode: 'BY',
};

describe('TravelDetailsContainer - Security & Sanitization', () => {
  describe('YouTube ID Validation', () => {
    it('should validate correct YouTube IDs', () => {
      expect(validateYoutubeId('dQw4w9WgXcQ')).toBe(true);
      expect(validateYoutubeId('9bZkp7q19f0')).toBe(true);
      expect(validateYoutubeId('jNQXAC9IVRw')).toBe(true);
    });

    it('should reject invalid YouTube IDs', () => {
      expect(validateYoutubeId('tooshort')).toBe(false);
      expect(validateYoutubeId('toolongidwithmorethanelevencharacters')).toBe(false);
      expect(validateYoutubeId('has spaces here')).toBe(false);
      expect(validateYoutubeId('has!special@chars')).toBe(false);
    });

    it('should safely extract YouTube ID from URLs', () => {
      expect(safeGetYoutubeId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(safeGetYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(safeGetYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(safeGetYoutubeId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid YouTube URLs', () => {
      expect(safeGetYoutubeId('https://example.com')).toBeNull();
      expect(safeGetYoutubeId('https://youtube.com/watch?v=invalid')).toBeNull();
      expect(safeGetYoutubeId('')).toBeNull();
      expect(safeGetYoutubeId(null)).toBeNull();
    });
  });

  describe('HTML Sanitization', () => {
    it('should strip HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
      expect(stripHtml('<div><span>Test</span></div>')).toBe('Test');
    });

    it('should remove script tags and content', () => {
      const xssAttempt = 'Hello <script>alert("xss")</script> world';
      expect(stripHtml(xssAttempt)).not.toContain('script');
      expect(stripHtml(xssAttempt)).not.toContain('alert');
    });

    it('should remove style tags and content', () => {
      const withStyles = 'Text <style>body{display:none}</style> more';
      expect(stripHtml(withStyles)).not.toContain('style');
      expect(stripHtml(withStyles)).not.toContain('display');
    });

    it('should normalize whitespace', () => {
      expect(stripHtml('Hello    world')).toBe('Hello world');
      expect(stripHtml('Text\n\nwith\n\nnewlines')).toBe('Text with newlines');
    });

    it('should provide default fallback text', () => {
      expect(stripHtml('')).toBe('Найди место для путешествия и поделись своим опытом.');
      expect(stripHtml(null)).toBe('Найди место для путешествия и поделись своим опытом.');
    });
  });

  describe('JSON-LD Structure Data', () => {
    const mockTravel: Travel = {
      ...baseTravel,
      description: '<p>A test travel description</p>',
      gallery: ['https://example.com/image.jpg'],
    };

    it('should create safe JSON-LD from travel data', () => {
      const jsonLd = createSafeJsonLd(mockTravel);
      expect(jsonLd).not.toBeNull();
      expect(jsonLd).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Test Travel',
        description: 'A test travel description',
        image: ['https://example.com/image.jpg'],
        url: 'https://metravel.by/travels/test-travel',
      });
    });

    it('should handle missing data gracefully', () => {
      const minimal: Travel = {
        ...baseTravel,
        name: '',
        description: '',
        gallery: [],
        slug: '',
      };
      const jsonLd = createSafeJsonLd(minimal);
      expect(jsonLd).not.toBeNull();
      expect(jsonLd!['@context']).toBe('https://schema.org');
      expect(jsonLd!['@type']).toBe('Article');
      expect(jsonLd!.headline).toBeUndefined();
    });

    it('should truncate long values', () => {
      const longTravel: Travel = {
        ...mockTravel,
        name: 'A'.repeat(250),
      };
      const jsonLd = createSafeJsonLd(longTravel);
      expect(jsonLd).not.toBeNull();
      expect(jsonLd!.headline?.length).toBeLessThanOrEqual(200);
    });

    it('should never include null data', () => {
      const jsonLd = createSafeJsonLd(null);
      expect(jsonLd).toBeNull();
    });
  });

  describe('URL Safety', () => {
    it('should create safe versioned image URLs', () => {
      const url = createSafeImageUrl('https://cdn.example.com/image.jpg', '2025-01-01', 123);
      expect(url).toContain('https://cdn.example.com/image.jpg');
      expect(url).toContain('v=');
    });

    it('should handle missing parameters', () => {
      expect(createSafeImageUrl('')).toBe('');
      expect(createSafeImageUrl(undefined)).toBe('');
      expect(createSafeImageUrl(undefined as unknown as string)).toBe('');
    });

    it('should extract safe origins', () => {
      expect(getSafeOrigin('https://example.com/path')).toBe('https://example.com');
      expect(getSafeOrigin('https://sub.example.com:3000/path')).toBe('https://sub.example.com:3000');
    });

    it('should return null for invalid URLs', () => {
      expect(getSafeOrigin('not a url')).toBeNull();
      expect(getSafeOrigin('')).toBeNull();
      expect(getSafeOrigin(undefined)).toBeNull();
    });
  });

  describe('Preconnect Domain Whitelisting', () => {
    it('should allow whitelisted preconnect domains', () => {
      expect(isSafePreconnectDomain('https://maps.googleapis.com')).toBe(true);
      expect(isSafePreconnectDomain('https://img.youtube.com')).toBe(true);
      expect(isSafePreconnectDomain('https://api.metravel.by')).toBe(true);
    });

    it('should reject non-whitelisted domains', () => {
      expect(isSafePreconnectDomain('https://evil.com')).toBe(false);
      expect(isSafePreconnectDomain('http://example.com')).toBe(false);
      expect(isSafePreconnectDomain(null)).toBe(false);
      expect(isSafePreconnectDomain('')).toBe(false);
    });
  });
});
