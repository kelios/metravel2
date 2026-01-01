import { useState, useCallback } from 'react';

/**
 * ✅ ФАЗА 2: Hook для управления превью карточки путешествия
 * Используется во всех шагах для показа модального окна
 */
export function useTravelPreview() {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const showPreview = useCallback(() => {
    setIsPreviewVisible(true);
  }, []);

  const hidePreview = useCallback(() => {
    setIsPreviewVisible(false);
  }, []);

  return {
    isPreviewVisible,
    showPreview,
    hidePreview,
  };
}

export default useTravelPreview;

