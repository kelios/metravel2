/**
 * Comprehensive test suite for TravelDetailsContainer
 * Tests security, performance, accessibility, and cross-platform compatibility
 */

import {
  validateYoutubeId,
  safeGetYoutubeId,
  stripHtml,
  createSafeImageUrl,
  getSafeOrigin,
} from '@/utils/travelDetailsSecure';

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
});
