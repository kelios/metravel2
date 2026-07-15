// hooks/useAndroidBackHandler.ts
// AND-07: Centralized Android back button handling.
// - Home screen: double-tap to exit with Toast.
// - Modals/sheets: close on back press.
// - Default: let the router handle navigation.
import { useEffect, useRef, useCallback } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { translate as i18nT } from '@/i18n'


const HOME_PATHS = ['/', '/index', '/search', '/(tabs)', '/(tabs)/index', '/(tabs)/search'];

type AndroidBackHandlerOptions = {
  /**
   * Явная цель аппаратной кнопки «Назад». Нужна, когда экран открыт переходом
   * между tab-роутами (напр. Профиль → Мои точки): `router.back()` уводит на
   * предыдущую вкладку (Главную), а не на экран-источник (#548). Возврат `true`
   * означает, что переход выполнен и событие поглощено.
   */
  resolveBack?: () => boolean;
};

/**
 * Hook that manages Android hardware back button behavior.
 *
 * @param onDismiss - Optional callback to close a visible modal/sheet.
 *                    Return `true` if the modal was dismissed (back press consumed).
 *                    Return `false` to let the default behavior proceed.
 * @param options   - Optional explicit back target (`resolveBack`).
 */
export function useAndroidBackHandler(
  onDismiss?: () => boolean,
  options?: AndroidBackHandlerOptions,
) {
  const pathname = usePathname();
  const router = useRouter();
  const lastBackPressTime = useRef(0);
  const resolveBack = options?.resolveBack;

  const handleBackPress = useCallback((): boolean => {
    // 1. Try to dismiss active modal/sheet first
    if (onDismiss) {
      const dismissed = onDismiss();
      if (dismissed) return true;
    }

    // 2. Explicit back target (e.g. Профиль для экранов, открытых из профиля).
    if (resolveBack) {
      const handled = resolveBack();
      if (handled) return true;
    }

    // 3. On home screen — double-tap to exit
    const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/';
    const isHome = HOME_PATHS.includes(normalized);

    if (isHome) {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        // Second press within 2 seconds — let the app exit
        return false;
      }
      lastBackPressTime.current = now;
      ToastAndroid.show(i18nT('shared:hooks.useAndroidBackHandler.nazhmite_esche_raz_dlya_vyhoda_6b6fd338'), ToastAndroid.SHORT);
      return true;
    }

    // 4. Default: let the router go back
    if (router.canGoBack()) {
      router.back();
      return true;
    }

    return false;
  }, [pathname, router, onDismiss, resolveBack]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);
}

