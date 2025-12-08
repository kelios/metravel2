/**
 * Утилита для очистки некорректных данных favorites
 */

export const cleanupInvalidFavorites = (favorites: any[]): any[] => {
  const commonErrorCodes = [400, 401, 403, 404, 500, 503];
  
  return favorites.filter((item: any) => {
    // Skip null/undefined items
    if (!item) {
      return false;
    }
    
    // Проверяем, что ID не является HTTP кодом ошибки (400-599)
    const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
    
    if (typeof numericId === 'number' && commonErrorCodes.includes(numericId)) {
      console.warn(`Removing invalid favorite item with ID: ${item.id} (appears to be HTTP error code)`);
      return false;
    }
    
    // Проверяем, что у item есть необходимые поля
    if (!item.id || !item.type || !['travel', 'article'].includes(item.type)) {
      console.warn(`Removing invalid favorite item:`, item);
      return false;
    }
    
    return true;
  });
};

/**
 * Проверяет, является ли ID валидным (не HTTP код ошибки)
 */
export const isValidFavoriteId = (id: string | number): boolean => {
  // If it's a non-numeric string (like 'travel-123'), it's valid
  if (typeof id === 'string' && !/^\d+$/.test(id)) {
    return true;
  }
  
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  // If parsing failed (NaN), it's valid
  if (typeof numericId === 'number' && isNaN(numericId)) {
    return true;
  }
  
  // Only treat as invalid if it's a commonly used HTTP error code
  const commonErrorCodes = [400, 401, 403, 404, 500, 503];
  return !(typeof numericId === 'number' && commonErrorCodes.includes(numericId));
};
