/**
 * Кастомный хук для управления видимостью секций (персонализация, подборка недели)
 * Вынесена логика видимости для переиспользования и тестирования
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  PERSONALIZATION_VISIBLE_KEY, 
  WEEKLY_HIGHLIGHTS_VISIBLE_KEY 
} from '../utils/listTravelConstants';

export interface UseListTravelVisibilityProps {
  externalPersonalizationVisible?: boolean;
  externalWeeklyHighlightsVisible?: boolean;
  onTogglePersonalization?: () => void;
  onToggleWeeklyHighlights?: () => void;
}

export interface UseListTravelVisibilityReturn {
  isPersonalizationVisible: boolean;
  isWeeklyHighlightsVisible: boolean;
  isInitialized: boolean;
  handleTogglePersonalization: () => void;
  handleToggleWeeklyHighlights: () => void;
}

/**
 * ✅ АРХИТЕКТУРА: Хук для управления видимостью секций
 * 
 * Логика:
 * - Поддерживает внешнее и внутреннее состояние
 * - Сохраняет состояние в storage
 * - Синхронизирует состояние между компонентами
 */
export function useListTravelVisibility({
  externalPersonalizationVisible,
  externalWeeklyHighlightsVisible,
  onTogglePersonalization,
  onToggleWeeklyHighlights,
}: UseListTravelVisibilityProps): UseListTravelVisibilityReturn {
  // Внутреннее состояние видимости (если не передано извне)
  const [internalPersonalizationVisible, setInternalPersonalizationVisible] = useState(true);
  const [internalWeeklyHighlightsVisible, setInternalWeeklyHighlightsVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Используем внешнее состояние, если передано, иначе внутреннее
  const isPersonalizationVisible = externalPersonalizationVisible !== undefined 
    ? externalPersonalizationVisible 
    : internalPersonalizationVisible;
  
  const isWeeklyHighlightsVisible = externalWeeklyHighlightsVisible !== undefined 
    ? externalWeeklyHighlightsVisible 
    : internalWeeklyHighlightsVisible;

  // ✅ АРХИТЕКТУРА: Загружаем сохраненное состояние видимости (только если не передано извне)
  useEffect(() => {
    if (externalPersonalizationVisible !== undefined || externalWeeklyHighlightsVisible !== undefined) {
      setIsInitialized(true);
      return;
    }

    const loadVisibility = async () => {
      try {
        if (Platform.OS === 'web') {
          const personalizationVisible = sessionStorage.getItem(PERSONALIZATION_VISIBLE_KEY);
          const weeklyHighlightsVisible = sessionStorage.getItem(WEEKLY_HIGHLIGHTS_VISIBLE_KEY);
          
          setInternalPersonalizationVisible(personalizationVisible !== 'false');
          setInternalWeeklyHighlightsVisible(weeklyHighlightsVisible !== 'false');
        } else {
          // ✅ FIX-004: Используем батчинг для загрузки данных
          const { getStorageBatch } = await import('@/src/utils/storageBatch');
          const storageData = await getStorageBatch([PERSONALIZATION_VISIBLE_KEY, WEEKLY_HIGHLIGHTS_VISIBLE_KEY]);
          
          setInternalPersonalizationVisible(storageData[PERSONALIZATION_VISIBLE_KEY] !== 'false');
          setInternalWeeklyHighlightsVisible(storageData[WEEKLY_HIGHLIGHTS_VISIBLE_KEY] !== 'false');
        }
      } catch (error) {
        console.error('Error loading visibility state:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadVisibility();
  }, [externalPersonalizationVisible, externalWeeklyHighlightsVisible]);

  // ✅ АРХИТЕКТУРА: Сохраняем состояние видимости
  const saveVisibility = useCallback(async (key: string, visible: boolean) => {
    try {
      if (Platform.OS === 'web') {
        if (visible) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, 'false');
        }
      } else {
        if (visible) {
          await AsyncStorage.removeItem(key);
        } else {
          await AsyncStorage.setItem(key, 'false');
        }
      }
    } catch (error) {
      console.error('Error saving visibility state:', error);
    }
  }, []);

  // ✅ АРХИТЕКТУРА: Обработчик переключения персонализации
  const handleTogglePersonalization = useCallback(() => {
    if (onTogglePersonalization) {
      onTogglePersonalization();
    } else {
      const newValue = !internalPersonalizationVisible;
      setInternalPersonalizationVisible(newValue);
      saveVisibility(PERSONALIZATION_VISIBLE_KEY, newValue);
    }
  }, [onTogglePersonalization, internalPersonalizationVisible, saveVisibility]);

  // ✅ АРХИТЕКТУРА: Обработчик переключения подборки недели
  const handleToggleWeeklyHighlights = useCallback(() => {
    if (onToggleWeeklyHighlights) {
      onToggleWeeklyHighlights();
    } else {
      const newValue = !internalWeeklyHighlightsVisible;
      setInternalWeeklyHighlightsVisible(newValue);
      saveVisibility(WEEKLY_HIGHLIGHTS_VISIBLE_KEY, newValue);
    }
  }, [onToggleWeeklyHighlights, internalWeeklyHighlightsVisible, saveVisibility]);

  return {
    isPersonalizationVisible,
    isWeeklyHighlightsVisible,
    isInitialized,
    handleTogglePersonalization,
    handleToggleWeeklyHighlights,
  };
}

