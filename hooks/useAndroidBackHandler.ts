// hooks/useAndroidBackHandler.ts
// AND-07: Centralized Android back button handling.
// - Home screen: double-tap to exit with Toast.
// - Modals/sheets: close on back press.
// - Default: let the router handle navigation.
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
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
 * The BackHandler subscription lives only while the calling screen is focused.
 * `BackHandler` serves the NEWEST subscription first and tab screens stay mounted
 * after the user leaves them, so a subscription that followed every render (it
 * used to re-subscribe on each `pathname` or callback change) let a hidden
 * screen win the hardware Back press — Calendar sent the user to the profile,
 * Messages closed an invisible thread (NAV-1).
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

  // Latest inputs live in refs so the subscription depends on focus only, not on
  // the identity of the callbacks or the current route.
  const pathnameRef = useRef(pathname);
  const onDismissRef = useRef(onDismiss);
  const resolveBackRef = useRef(resolveBack);
  useEffect(() => {
    pathnameRef.current = pathname;
    onDismissRef.current = onDismiss;
    resolveBackRef.current = resolveBack;
  });

  const handleBackPress = useCallback((): boolean => {
    // 1. Try to dismiss active modal/sheet first
    const dismiss = onDismissRef.current;
    if (dismiss && dismiss()) return true;

    // 2. Explicit back target (e.g. Профиль для экранов, открытых из профиля).
    const resolve = resolveBackRef.current;
    if (resolve && resolve()) return true;

    // 3. On home screen — double-tap to exit
    const normalized = pathnameRef.current.replace(/^\/\(tabs\)/, '') || '/';
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
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [handleBackPress]),
  );
}
