// __tests__/utils/imageErrorHandler.test.ts
import { 
  handleImageError, 
  isValidImageUrl, 
  getImagePlaceholder,
  optimizeImageUrl 
} from '@/src/utils/imageErrorHandler';

describe('imageErrorHandler', () => {
  describe('handleImageError', () => {
    it('should handle image load errors', () => {
      const error = new Error('Failed to load image');
      const url = 'https://example.com/image.jpg';
      
      expect(() => handleImageError(url, error)).not.toThrow();
    });

    it('should call onFallback for CORS errors', () => {
      const onFallback = jest.fn();
      const error = new Error('CORS policy');
      
      handleImageError('https://example.com/image.jpg', error, { onFallback });
      
      expect(onFallback).toHaveBeenCalled();
    });

    it('should call onRetry for network errors', (done) => {
      const onRetry = jest.fn();
      const error = new Error('network failed');
      
      handleImageError('https://example.com/image.jpg', error, { 
        onRetry,
        retryCount: 0,
        maxRetries: 3 
      });
      
      setTimeout(() => {
        expect(onRetry).toHaveBeenCalled();
        done();
      }, 1100);
    });

    it('should not retry after max attempts', () => {
      const onRetry = jest.fn();
      const onFallback = jest.fn();
      const error = new Error('network failed');
      
      handleImageError('https://example.com/image.jpg', error, { 
        onRetry,
        onFallback,
        retryCount: 3,
        maxRetries: 3 
      });
      
      expect(onFallback).toHaveBeenCalled();
    });
  });

  describe('isValidImageUrl', () => {
    it('should validate correct image URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
      expect(isValidImageUrl('http://example.com/image.webp')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidImageUrl('')).toBe(false);
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
    });

    it('should reject non-http protocols', () => {
      expect(isValidImageUrl('ftp://example.com/image.jpg')).toBe(false);
      expect(isValidImageUrl('file:///image.jpg')).toBe(false);
    });

    it('should validate URLs with image extensions', () => {
      expect(isValidImageUrl('https://example.com/photo.jpeg')).toBe(true);
      expect(isValidImageUrl('https://example.com/icon.svg')).toBe(true);
    });
  });

  describe('getImagePlaceholder', () => {
    it('should return SVG data URL', () => {
      const placeholder = getImagePlaceholder();
      expect(placeholder).toContain('data:image/svg+xml');
    });

    it('should accept custom dimensions', () => {
      const placeholder = getImagePlaceholder(800, 600);
      expect(placeholder).toContain('800');
      expect(placeholder).toContain('600');
    });

    it('should use default dimensions', () => {
      const placeholder = getImagePlaceholder();
      expect(placeholder).toContain('400');
      expect(placeholder).toContain('300');
    });
  });

  describe('optimizeImageUrl', () => {
    it('should add width parameter', () => {
      const url = 'https://example.com/image.jpg';
      const optimized = optimizeImageUrl(url, { width: 800 });
      expect(optimized).toContain('w=800');
    });

    it('should add quality parameter', () => {
      const url = 'https://example.com/image.jpg';
      const optimized = optimizeImageUrl(url, { quality: 90 });
      expect(optimized).toContain('q=90');
    });

    it('should add format parameter', () => {
      const url = 'https://example.com/image.jpg';
      const optimized = optimizeImageUrl(url, { format: 'webp' });
      expect(optimized).toContain('format=webp');
    });

    it('should return original URL if invalid', () => {
      const url = 'invalid-url';
      const optimized = optimizeImageUrl(url);
      expect(optimized).toBe(url);
    });

    it('should handle multiple parameters', () => {
      const url = 'https://example.com/image.jpg';
      const optimized = optimizeImageUrl(url, { 
        width: 800, 
        height: 600, 
        quality: 85 
      });
      expect(optimized).toContain('w=800');
      expect(optimized).toContain('h=600');
      expect(optimized).toContain('q=85');
    });
  });
});
