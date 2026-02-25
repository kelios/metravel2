import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, LogBox, useColorScheme } from "react-native";
import { SplashScreen, Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import AppProviders from "@/components/layout/AppProviders";
import Footer from '@/components/layout/Footer';
import ErrorBoundary from "@/components/ui/ErrorBoundary";
// Defensive lazy imports: fallback to empty component if module resolution fails
const EmptyFallback = () => null;
const safeLazy = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name?: string
) => React.lazy(() =>
  loader().catch((err) => {
    if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err);
    return { default: EmptyFallback as unknown as T };
  })
);

const SkipLinksLazy = safeLazy(() => import('@/components/layout/SkipLinks'), 'SkipLinks');
const NetworkStatusLazy = safeLazy(
  () => import('@/components/ui/NetworkStatus').then(m => {
    const Component = m.NetworkStatus ?? (m as any).default;
    if (!Component) throw new Error('NetworkStatus export not found');
    return { default: Component };
  }),
  'NetworkStatus'
);
const ReactQueryDevtoolsLazy: any = React.lazy(() =>
  import('@tanstack/react-query-devtools').then((m: any) => ({ default: m.ReactQueryDevtools }))
);
const ConsentBannerLazy = safeLazy(() => import('@/components/layout/ConsentBanner'), 'ConsentBanner');
const ToastLazy = safeLazy(() => import('@/components/ui/ToastHost'), 'ToastHost');
import { DESIGN_TOKENS } from "@/constants/designSystem"; 
import { useResponsive } from "@/hooks/useResponsive"; 
import { createOptimizedQueryClient } from "@/utils/reactQueryConfig";
import { getRuntimeConfigDiagnostics } from "@/utils/runtimeConfigDiagnostics";
import { devError, devWarn } from "@/utils/logger";
import { clearRecoverySessionState } from "@/utils/recovery/sessionRecovery";
import { ThemeProvider, useThemedColors, getThemedColors } from "@/hooks/useTheme";

if (__DEV__) {
  require("@expo/metro-runtime");
}

// ✅ ИСПРАВЛЕНИЕ: Глобальный CSS для web (box-sizing fix)
if (Platform.OS === 'web') {
  require('./global.css');
}

// useLayoutEffect warning is suppressed by the inline script in +html.tsx

// Подавляем внешние депрекейшн-варнинги от зависимостей (react-native-element-dropdown)
LogBox.ignoreLogs([
  'TouchableWithoutFeedback is deprecated. Please use Pressable.',
  'Image: style.tintColor is deprecated. Please use props.tintColor.',
]);

/** ===== Helpers ===== */
const isWeb = Platform.OS === "web";


const useAppFonts: any = isWeb
  ? () => [true, null]
  : require('expo-font').useFonts;

/** Тема */
// ✅ ИСПРАВЛЕНИЕ: Унифицирована цветовая палитра - используется DESIGN_TOKENS

/** Splash на native */
if (!isWeb) {
    SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
    useEffect(() => {
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return;
        // On production web, Expo's bundler inlines individual process.env.EXPO_PUBLIC_*
        // references but does NOT populate the process.env object. The diagnostics
        // function reads env vars from the object, producing false positives
        // (e.g. API_URL_MISSING) even though the app works correctly.
        // Only run diagnostics in dev where process.env is fully available.
        // NOTE: __DEV__ alone is not sufficient — the bundler may strip the guard
        // but keep the body. Use a runtime hostname check as defense-in-depth.
        if (!__DEV__) return;
        if (isWeb && typeof window !== 'undefined') {
            const h = window.location?.hostname;
            if (h === 'metravel.by' || h === 'www.metravel.by') return;
        }
        const diagnostics = getRuntimeConfigDiagnostics();
        for (const diagnostic of diagnostics) {
            const line = `[Config:${diagnostic.code}] ${diagnostic.message}`;
            if (diagnostic.severity === 'error') {
                devError(line);
            } else {
                devWarn(line);
            }
        }
    }, []);

    useEffect(() => {
        if (!isWeb) SplashScreen.hideAsync().catch((error) => {
            // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки скрытия splash screen
            if (__DEV__) {
                console.warn('[RootLayout] Ошибка hideAsync:', error);
            }
        });
    }, []);
    return <RootLayoutNav />;
}

	function RootLayoutNav() {
	    const pathname = usePathname();
	    const colorScheme = useColorScheme();
	    const { width, isHydrated: isResponsiveHydrated = true } = useResponsive();
    const loadingColors = useMemo(
      () => getThemedColors(colorScheme === 'dark'),
      [colorScheme],
    );

    // ✅ FIX: Создаем queryClient внутри компонента для избежания проблем с SSR/гидрацией
    const [queryClient] = useState(() => createOptimizedQueryClient({
        mutations: {
            retry: false,
        },
    }));

    // Web analytics page-view tracking is handled centrally in getAnalyticsInlineScript().
    // Keeping additional tracking here duplicates GA/Yandex events on route changes.

    // Single source of truth for width: useResponsive().
    // While web hydration is not complete we keep desktop layout to avoid mismatch.
    const isMobile =
      Platform.OS !== "web"
        ? true
        : isResponsiveHydrated
          ? width < DESIGN_TOKENS.breakpoints.mobile
          : false;


    const showFooter = useMemo(
      () => {
        const p = pathname || "";
        if (["/login", "/onboarding"].includes(p)) return false;
        // Map page uses full viewport height — footer steals space from the map
        if (p === "/map") return false;
        // On travel create/edit wizard we render our own bottom actions footer.
        // The global mobile dock would overlap it.
        // if (p.startsWith('/travel')) return false;
        return true;
      },
      [pathname]
    );

    /** === динамическая высота ДОКА футера (только иконки) === */
    const [dockHeight, setDockHeight] = useState(0);
    
    /** === SSR-safe Toast: рендерим только на клиенте === */
    const [isMounted, setIsMounted] = useState(false);
    const [showConsentBanner, setShowConsentBanner] = useState(false);
    
    useEffect(() => {
        let mountedTimer: ReturnType<typeof setTimeout> | null = null;
        let consentTimer: ReturnType<typeof setTimeout> | null = null;
        let rafId: number | null = null;

        // Strip the _cb cache-busting param added by stale-chunk recovery.
        if (isWeb && typeof window !== 'undefined') {
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('_cb')) {
              url.searchParams.delete('_cb');
              // Use the native replaceState to bypass our patched version,
              // which would convert this to pushState or trigger hardNavigateIfPending.
              History.prototype.replaceState.call(window.history, window.history.state, '', url.toString());
            }
          } catch { /* noop */ }
        }

        // After the page loads and stays stable for 10s, clear ALL recovery
        // session keys. This ensures that future errors (e.g. from lazy-loaded
        // chunks on /map) get a fresh set of recovery attempts instead of being
        // blocked by stale counters from a previous recovery cycle.
        let stableTimer: ReturnType<typeof setTimeout> | null = null;
        if (isWeb && typeof window !== 'undefined') {
          stableTimer = setTimeout(() => {
            clearRecoverySessionState({
              clearEmergencyKey: true,
              clearExhaustedAutoRetryKeys: true,
              clearReact130RecoveryKeys: true,
              clearControllerChangeReloadKey: true,
            });
          }, 10000);
        }

        // Defer mount-only UI to avoid hydration-time updates (React error 421 with Suspense).
        mountedTimer = setTimeout(() => setIsMounted(true), 0);

        // Відкладаємо ConsentBanner на 4 секунди для покращення FCP/LCP
        consentTimer = setTimeout(() => setShowConsentBanner(true), 4000);

        if (isWeb && typeof document !== 'undefined') {
          rafId = requestAnimationFrame(() => {
            document.documentElement.classList.add('app-hydrated');
          });
        }

        return () => {
          if (mountedTimer) clearTimeout(mountedTimer);
          if (consentTimer) clearTimeout(consentTimer);
          if (stableTimer) clearTimeout(stableTimer);
          if (rafId != null) cancelAnimationFrame(rafId);
        };
    }, []);


    // Fonts:
    // - On native we must load app fonts before rendering.
    // - On web we do not load fonts via expo-font here. @expo/vector-icons manages its own
    //   web font injection; attempting to load via expo-font can cause timeouts and missing glyphs.
    const [fontsLoaded, fontError] = useAppFonts(
      isWeb
        ? {}
        : {
            SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
            "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
            "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
            ...(require('@expo/vector-icons/Feather') as any).font,
          }
    );

    // Font timeout suppression (web only).
    // Module error recovery is handled by the inline script in +html.tsx
    // to catch errors before React mounts.
    useEffect(() => {
      if (!isWeb) return;
      const onUnhandled = (e: PromiseRejectionEvent) => {
        const reason = (e as any)?.reason;
        const msg = String(reason?.message ?? reason ?? '');
        const stack = typeof reason?.stack === 'string' ? reason.stack : '';

        const isFontTimeout =
          msg.includes('timeout exceeded') &&
          (String(msg).toLowerCase().includes('fontfaceobserver') ||
            String(stack).toLowerCase().includes('fontfaceobserver') ||
            msg.includes('6000ms timeout exceeded'));

        if (isFontTimeout) {
          e.preventDefault();
        }
      };

      window.addEventListener('unhandledrejection', onUnhandled);
      return () => {
        window.removeEventListener('unhandledrejection', onUnhandled);
      };
    }, []);

    // Avoid keeping focus inside screens that become aria-hidden after navigation (web)
    useEffect(() => {
      if (!isWeb) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === 'function') {
        active.blur();
      }

      const main = document.getElementById('main-content');
      if (main) {
        const hadTabIndex = main.hasAttribute('tabindex');
        if (!hadTabIndex) {
          main.setAttribute('tabindex', '-1');
        }
        main.focus();
        if (!hadTabIndex) {
          main.removeAttribute('tabindex');
        }
      }
    }, [pathname]);

    useEffect(() => {
      if (fontError && !isWeb) {
        console.error("Font loading error:", fontError);
      }
    }, [fontError]);

    // FIX: Browser back button doesn't work with Tabs navigator.
    // Expo Router's useLinking calls replaceState (instead of pushState) when switching
    // between already-visited tabs because the tab history length doesn't change.
    // This patch converts replaceState → pushState when the URL path actually changes.
    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;

      const originalReplace = window.history.replaceState.bind(window.history);
      const originalPush = window.history.pushState.bind(window.history);

      window.history.pushState = function patchedPushState(
        data: any,
        unused: string,
        url?: string | URL | null,
      ) {
        return originalPush(data, unused, url);
      };

      window.history.replaceState = function patchedReplaceState(
        data: any,
        unused: string,
        url?: string | URL | null,
      ) {
        if (url != null) {
          const currentPath = window.location.pathname + window.location.search;
          let newPath: string;
          try {
            const resolved = new URL(String(url), window.location.href);
            newPath = resolved.pathname + resolved.search;
          } catch {
            newPath = String(url);
          }
          if (newPath !== currentPath) {
            // Path changed — push instead of replace so browser back button works
            return window.history.pushState(data, unused, url);
          }
        }
        return originalReplace(data, unused, url);
      };

      return () => {
        window.history.replaceState = originalReplace;
        window.history.pushState = originalPush;
      };
    }, []);

    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;

      const isProd = window.location.hostname === 'metravel.by' || window.location.hostname === 'www.metravel.by';
      if (!isProd) return;

      const disableServiceWorkerCaching = async () => {
        try {
          if (!('serviceWorker' in navigator)) return;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        } catch {
          // noop
        }

        try {
          if (typeof caches === 'undefined') return;
          const keys = await caches.keys();
          const targets = keys.filter((key) => key.startsWith('metravel-'));
          await Promise.all(targets.map((key) => caches.delete(key)));
        } catch {
          // noop
        }
      };

      void disableServiceWorkerCaching();

      return () => {};
    }, []);

    if (!fontsLoaded && !isWeb) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: loadingColors.background }}>
          <ActivityIndicator size="small" color={loadingColors.primary} />
        </View>
      );
    }


    // Показываем фон-карту только на экранах рулетки, на остальных страницах сохраняем чистый белый фон
    // На мобильном web фон мешает доку/контенту — отключаем.
    const showMapBackground =
      Platform.OS === 'web' &&
      !isMobile &&
      (pathname?.includes('roulette') || pathname?.includes('random'));

    return (
      <ThemeProvider>
        <ErrorBoundary>
          <ThemedContent
            showMapBackground={showMapBackground}
            showFooter={showFooter}
            isMobile={isMobile}
            dockHeight={dockHeight}
            setDockHeight={setDockHeight}
            isMounted={isMounted}
            showConsentBanner={showConsentBanner}
            queryClient={queryClient}
          />
        </ErrorBoundary>
      </ThemeProvider>
    );
}

// Компонент с доступом к ThemeProvider
function ThemedContent({
  showMapBackground,
  showFooter,
  isMobile,
  dockHeight,
  setDockHeight,
  isMounted,
  showConsentBanner,
  queryClient,
}: {
  showMapBackground: boolean;
  showFooter: boolean;
  isMobile: boolean;
  dockHeight: number;
  setDockHeight: (h: number) => void;
  isMounted: boolean;
  showConsentBanner: boolean;
  queryClient: any;
}) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapBackground = showMapBackground ? require("../assets/travel/roulette-map-bg.jpg") : null;
  const WEB_FOOTER_RESERVE_HEIGHT = 56;

  const bottomGutter = useMemo(() => {
    if (!showFooter || !isMobile) return null;

    if (Platform.OS === 'web') {
      return <View testID="bottom-gutter" style={{ height: WEB_FOOTER_RESERVE_HEIGHT }} />;
    }

    if (dockHeight <= 0) return null;

    return <View testID="bottom-gutter" style={{ height: dockHeight }} />;
  }, [showFooter, isMobile, dockHeight]);

  return (
    <AppProviders queryClient={queryClient}>
                          <View style={styles.container}>
                              {showMapBackground && (
                                <Image
                                  source={mapBackground}
                                  style={styles.backgroundImage}
                                  resizeMode="cover"
                                />
                              )}
	                              <Head>
	                                  <link rel="icon" href="/favicon.ico" />
	                                  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/logo_yellow_60x60.png" />
	                                  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/logo_yellow_60x60.png" />
	                                  <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/logo_yellow_60x60.png" />
	                              </Head>

                              {/* ✅ УЛУЧШЕНИЕ: Skip links для доступности */}
                              {isWeb && isMounted && (
                                <React.Suspense fallback={null}>
                                  <SkipLinksLazy />
                                </React.Suspense>
                              )}

                              {/* ✅ FIX-005: Индикатор статуса сети */}
                              {(!isWeb || isMounted) && (
                                <React.Suspense fallback={null}>
                                  <NetworkStatusLazy position="top" />
                                </React.Suspense>
                              )}

                              <View style={[styles.content]}>
                                  <Stack screenOptions={{ headerShown: false }}>
                                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                  </Stack>

                                  {/* Прокладка: только высота док-строки футера */}
                                  {bottomGutter}
                              </View>

                              {Platform.OS === 'web' && __DEV__ ? (
                                <React.Suspense fallback={null}>
                                  <ReactQueryDevtoolsLazy initialIsOpen={false} />
                                </React.Suspense>
                              ) : null}

                              {/* Баннер согласия с компактным интерфейсом (web only) */}
                              {(!isWeb || showConsentBanner) && (
                                <React.Suspense fallback={null}>
                                  <ConsentBannerLazy />
                                </React.Suspense>
                              )}

                              {showFooter && (!isWeb || isMounted) && (
                                <View style={[styles.footerWrapper, isWeb && isMobile ? ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 } as any) : null]}>
                                  <Footer
                                    /** Получаем высоту док-строки (мобайл). На десктопе придёт 0. */
                                    onDockHeight={(h) => setDockHeight(h)}
                                  />
                                </View>
                              )}
                        </View>
            {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
            {isMounted && (
              <React.Suspense fallback={null}>
                <ToastLazy />
              </React.Suspense>
            )}
    </AppProviders>
  );
}

// ThemedPaperProvider is implemented as platform-specific component:
// - web: no-op wrapper
// - native: react-native-paper provider

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
        flexDirection: 'column',
        // Динамический фон для поддержки тем
        backgroundColor: colors.background,
        ...(Platform.OS === 'web'
          ? ({
              minHeight: '100vh',
              overflow: 'visible',
            } as any)
          : null),
    },
    backgroundImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        // Мягкая текстура: заметна, но не кричащая
        opacity: 0.45,
    },
    content: {
        flex: 1,
        flexBasis: 0,
        ...(Platform.OS === 'web'
          ? ({
              flexGrow: 1,
              minHeight: 0,
            } as any)
          : null),
    },
    footerWrapper: {
        marginTop: 'auto',
        flexShrink: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
        width: '100%',
        alignItems: 'center',
    },
    footerFallback: {
        padding: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.backgroundTertiary,
    },
    fontLoader: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        // Динамический фон для экрана загрузки шрифтов
        backgroundColor: colors.background,
    },
});
