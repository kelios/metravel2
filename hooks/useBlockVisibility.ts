// hooks/useBlockVisibility.ts
// ✅ РЕДИЗАЙН: Хук для управления видимостью и состоянием блоков

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BlockState {
  expanded: boolean;
  hidden: boolean;
}

export interface BlocksState {
  [blockId: string]: BlockState;
}

const STORAGE_KEY = 'metravel_blocks_state';
const DEFAULT_STATE: BlocksState = {
  welcomeBanner: { expanded: true, hidden: false },
  search: { expanded: true, hidden: false },
  tabs: { expanded: true, hidden: false },
  recommendations: { expanded: false, hidden: false },
  recentViews: { expanded: false, hidden: false },
  travelCards: { expanded: true, hidden: false },
  filters: { expanded: true, hidden: false }, // ✅ ИСПРАВЛЕНИЕ: Фильтры открыты по умолчанию
  popularCategories: { expanded: false, hidden: false },
  hero: { expanded: true, hidden: false },
  footer: { expanded: true, hidden: false },
};

export function useBlockVisibility() {
  const [blocksState, setBlocksState] = useState<BlocksState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Загрузка состояния из AsyncStorage
  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setBlocksState({ ...DEFAULT_STATE, ...parsed });
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading blocks state:', error);
        setIsLoaded(true);
      }
    };

    loadState();
  }, []);

  // Сохранение состояния в AsyncStorage
  const saveState = useCallback(async (newState: BlocksState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Error saving blocks state:', error);
    }
  }, []);

  // Обновление состояния блока
  const updateBlock = useCallback(
    (blockId: string, updates: Partial<BlockState>) => {
      setBlocksState((prev) => {
        const newState = {
          ...prev,
          [blockId]: {
            ...prev[blockId],
            ...updates,
          },
        };
        saveState(newState);
        return newState;
      });
    },
    [saveState]
  );

  // Переключение expanded
  const toggleExpanded = useCallback(
    (blockId: string) => {
      updateBlock(blockId, {
        expanded: !(blocksState[blockId]?.expanded ?? false),
      });
    },
    [blocksState, updateBlock]
  );

  // Переключение hidden
  const toggleHidden = useCallback(
    (blockId: string) => {
      updateBlock(blockId, {
        hidden: !(blocksState[blockId]?.hidden ?? false),
      });
    },
    [blocksState, updateBlock]
  );

  // Сброс всех блоков к значениям по умолчанию
  const resetAll = useCallback(() => {
    setBlocksState(DEFAULT_STATE);
    saveState(DEFAULT_STATE);
  }, [saveState]);

  // Установка режима (компактный, расширенный, умный)
  const setMode = useCallback(
    (mode: 'compact' | 'expanded' | 'smart') => {
      const newState: BlocksState = { ...blocksState };

      if (mode === 'compact') {
        // Все свернуто, но видимо
        Object.keys(newState).forEach((key) => {
          newState[key] = { expanded: false, hidden: false };
        });
      } else if (mode === 'expanded') {
        // Все развернуто
        Object.keys(newState).forEach((key) => {
          newState[key] = { expanded: true, hidden: false };
        });
      } else if (mode === 'smart') {
        // Умный режим: важные блоки развернуты
        newState.welcomeBanner = { expanded: false, hidden: false };
        newState.search = { expanded: true, hidden: false };
        newState.tabs = { expanded: true, hidden: false };
        newState.recommendations = { expanded: true, hidden: false };
        newState.recentViews = { expanded: false, hidden: false };
        newState.travelCards = { expanded: true, hidden: false };
        newState.filters = { expanded: false, hidden: false };
        newState.popularCategories = { expanded: false, hidden: false };
        newState.hero = { expanded: true, hidden: false };
        newState.footer = { expanded: false, hidden: false };
      }

      setBlocksState(newState);
      saveState(newState);
    },
    [blocksState, saveState]
  );

  // Получить состояние блока
  const getBlockState = useCallback(
    (blockId: string): BlockState => {
      return blocksState[blockId] || { expanded: true, hidden: false };
    },
    [blocksState]
  );

  return {
    blocksState,
    isLoaded,
    toggleExpanded,
    toggleHidden,
    updateBlock,
    resetAll,
    setMode,
    getBlockState,
  };
}

