import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { RECOMMENDATIONS_VISIBLE_KEY } from '../utils/listTravelConstants';

let nativeAsyncStorageModulePromise: Promise<typeof import('@react-native-async-storage/async-storage')> | null = null;

const getNativeAsyncStorageModule = async () => {
  if (!nativeAsyncStorageModulePromise) {
    nativeAsyncStorageModulePromise = import('@react-native-async-storage/async-storage');
  }
  return nativeAsyncStorageModulePromise;
};

const loadNativeRecommendationsVisibility = async (): Promise<boolean> => {
  const storageModule = await getNativeAsyncStorageModule();
  const stored = await storageModule.default.getItem(RECOMMENDATIONS_VISIBLE_KEY);
  return stored === 'true';
};

const saveNativeRecommendationsVisibility = async (visible: boolean) => {
  const storageModule = await getNativeAsyncStorageModule();
  await storageModule.default.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
};

export interface UseRecommendationsVisibilityResult {
  isRecommendationsVisible: boolean;
  setIsRecommendationsVisible: (visible: boolean) => void;
}

export function useRecommendationsVisibility(): UseRecommendationsVisibilityResult {
  const [isRecommendationsVisible, setIsRecommendationsVisible] = useState<boolean>(() => {
    if (Platform.OS !== 'web') return false;
    try {
      const stored = sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [initialized, setInitialized] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isMounted = true;
    (async () => {
      try {
        const stored = await loadNativeRecommendationsVisibility();
        if (!isMounted) return;
        setIsRecommendationsVisible(stored);
      } catch (error) {
        console.error('Error loading recommendations visibility:', error);
      } finally {
        if (isMounted) setInitialized(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      if (!initialized) return;
      setIsRecommendationsVisible(visible);
      (async () => {
        try {
          if (Platform.OS === 'web') {
            sessionStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, visible ? 'true' : 'false');
          } else {
            await saveNativeRecommendationsVisibility(visible);
          }
        } catch (error) {
          console.error('Error saving recommendations visibility:', error);
        }
      })();
    },
    [initialized],
  );

  return {
    isRecommendationsVisible,
    setIsRecommendationsVisible: handleVisibilityChange,
  };
}
