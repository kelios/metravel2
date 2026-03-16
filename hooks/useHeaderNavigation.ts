import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

type UseHeaderNavigationOptions = {
  onBeforeNavigate?: () => void;
};

type UseHeaderNavigationResult = {
  handleNavPress: (path: string, external?: boolean) => void;
  handleNavigate: (path: string, extraAction?: () => void) => void;
};

/**
 * Shared navigation logic for header components.
 * Handles both internal routing and external links.
 */
export function useHeaderNavigation({
  onBeforeNavigate,
}: UseHeaderNavigationOptions = {}): UseHeaderNavigationResult {
  const router = useRouter();

  const handleNavPress = useCallback(
    (path: string, external?: boolean) => {
      onBeforeNavigate?.();

      if (external) {
        if (Platform.OS === 'web') {
          openExternalUrlInNewTab(path);
        } else {
          openExternalUrl(path);
        }
        return;
      }

      router.push(path as never);
    },
    [router, onBeforeNavigate]
  );

  const handleNavigate = useCallback(
    (path: string, extraAction?: () => void) => {
      extraAction?.();
      onBeforeNavigate?.();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        void openExternalUrlInNewTab(path, {
          allowRelative: true,
          baseUrl: window.location.origin,
          windowFeatures: 'noopener',
        });
      } else {
        router.push(path as never);
      }
    },
    [router, onBeforeNavigate]
  );

  return { handleNavPress, handleNavigate };
}

export default useHeaderNavigation;
