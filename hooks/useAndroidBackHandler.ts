// hooks/useAndroidBackHandler.ts
// AND-07: Centralized Android back button handling.
// - Home screen: double-tap to exit with Toast.
// - Modals/sheets: close on back press.
// - Default: let the router handle navigation.
import { useEffect, useRef, useCallback } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

const HOME_PATHS = ['/', '/index', '/search', '/(tabs)', '/(tabs)/index', '/(tabs)/search'];

/**
 * Hook that manages Android hardware back button behavior.
 *
 * @param onDismiss - Optional callback to close a visible modal/sheet.
 *                    Return `true` if the modal was dismissed (back press consumed).
 *                    Return `false` to let the default behavior proceed.
 */
export function useAndroidBackHandler(onDismiss?: () => boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const lastBackPressTime = useRef(0);

  const handleBackPress = useCallback((): boolean => {
    // 1. Try to dismiss active modal/sheet first
    if (onDismiss) {
      const dismissed = onDismiss();
      if (dismissed) return true;
    }

    // 2. On home screen — double-tap to exit
    const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/';
    const isHome = HOME_PATHS.includes(normalized);

    if (isHome) {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        // Second press within 2 seconds — let the app exit
        return false;
      }
      lastBackPressTime.current = now;
      ToastAndroid.show('Нажмите ещё раз для выхода', ToastAndroid.SHORT);
      return true;
    }

    // 3. Default: let the router go back
    if (router.canGoBack()) {
      router.back();
      return true;
    }

    return false;
  }, [pathname, router, onDismiss]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);
}

