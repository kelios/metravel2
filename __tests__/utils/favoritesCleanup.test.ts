import { cleanupInvalidFavorites, isValidFavoriteId } from '@/src/utils/favoritesCleanup';

describe('favoritesCleanup', () => {
  describe('isValidFavoriteId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidFavoriteId(1)).toBe(true);
      expect(isValidFavoriteId(123)).toBe(true);
      expect(isValidFavoriteId('456')).toBe(true);
      expect(isValidFavoriteId('travel-123')).toBe(true);
      expect(isValidFavoriteId('article-abc')).toBe(true);
    });

    it('should return false for HTTP error codes', () => {
      expect(isValidFavoriteId(400)).toBe(false);
      expect(isValidFavoriteId(401)).toBe(false);
      expect(isValidFavoriteId(403)).toBe(false);
      expect(isValidFavoriteId(404)).toBe(false);
      expect(isValidFavoriteId(500)).toBe(false);
      expect(isValidFavoriteId(503)).toBe(false);
      expect(isValidFavoriteId('503')).toBe(false);
      expect(isValidFavoriteId('404')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidFavoriteId(399)).toBe(true); // Just below error codes
      expect(isValidFavoriteId(600)).toBe(true); // Just above error codes
      expect(isValidFavoriteId(0)).toBe(true);
      expect(isValidFavoriteId(-1)).toBe(true);
    });
  });

  describe('cleanupInvalidFavorites', () => {
    it('should filter out invalid favorite items', () => {
      const favorites = [
        { id: 1, type: 'travel', title: 'Valid Travel 1' },
        { id: '503', type: 'travel', title: 'Invalid Travel (HTTP error)' },
        { id: 123, type: 'article', title: 'Valid Article' },
        { id: '404', type: 'article', title: 'Invalid Article (HTTP error)' },
        { id: 'travel-456', type: 'travel', title: 'Valid Travel 2' },
      ];

      const cleaned = cleanupInvalidFavorites(favorites);
      
      expect(cleaned).toHaveLength(3);
      expect(cleaned).toEqual([
        { id: 1, type: 'travel', title: 'Valid Travel 1' },
        { id: 123, type: 'article', title: 'Valid Article' },
        { id: 'travel-456', type: 'travel', title: 'Valid Travel 2' },
      ]);
    });

    it('should remove items with missing required fields', () => {
      const favorites = [
        { id: 1, type: 'travel', title: 'Valid Travel' },
        { id: 2, title: 'Missing type' }, // Missing type
        { type: 'article', title: 'Missing id' }, // Missing id
        { id: 3, type: 'invalid', title: 'Invalid type' }, // Invalid type
        { id: 4, type: 'article' }, // Missing title (but title might be optional)
      ];

      const cleaned = cleanupInvalidFavorites(favorites);
      
      expect(cleaned).toHaveLength(2);
      expect(cleaned).toEqual([
        { id: 1, type: 'travel', title: 'Valid Travel' },
        { id: 4, type: 'article' },
      ]);
    });

    it('should handle empty array', () => {
      const cleaned = cleanupInvalidFavorites([]);
      expect(cleaned).toEqual([]);
    });

    it('should handle null/undefined items', () => {
      const favorites = [
        { id: 1, type: 'travel', title: 'Valid Travel' },
        null,
        undefined,
        { id: 2, type: 'article', title: 'Valid Article' },
      ] as any;

      const cleaned = cleanupInvalidFavorites(favorites);
      
      expect(cleaned).toHaveLength(2);
      expect(cleaned).toEqual([
        { id: 1, type: 'travel', title: 'Valid Travel' },
        { id: 2, type: 'article', title: 'Valid Article' },
      ]);
    });
  });
});
