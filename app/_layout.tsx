import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, LogBox, useColorScheme } from "react-native";
import { SplashScreen, Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import { FiltersProvider } from "@/providers/FiltersProvider";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import SkipLinks from "@/components/SkipLinks";
const NetworkStatusLazy = React.lazy(() => import('@/components/NetworkStatus').then(m => ({ default: m.NetworkStatus })));
const ReactQueryDevtoolsLazy: any = React.lazy(() =>
  import('@tanstack/react-query-devtools').then((m: any) => ({ default: m.ReactQueryDevtools }))
);
import ThemedPaperProvider from "@/components/ThemedPaperProvider";
const FooterLazy = React.lazy(() => import('@/components/Footer'));
const ConsentBannerLazy = React.lazy(() => import('@/components/ConsentBanner'));
const ToastLazy = React.lazy(() => import('@/components/ToastHost'));
import { DESIGN_TOKENS } from "@/constants/designSystem"; 
import { useResponsive } from "@/hooks/useResponsive"; 
import { createOptimizedQueryClient } from "@/src/utils/reactQueryConfig";
import { ThemeProvider, useThemedColors, getThemedColors } from "@/hooks/useTheme";

if (__DEV__) {
  require("@expo/metro-runtime");
}

// ✅ ИСПРАВЛЕНИЕ: Глобальный CSS для web (box-sizing fix)
if (Platform.OS === 'web') {
  require('./global.css');
}

// Подавляем предупреждение useLayoutEffect для React Navigation на вебе
if (Platform.OS === 'web') {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('useLayoutEffect does nothing on the server')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

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

/** Хук готовности по бездействию (web) */
// ✅ FIX-006: Исправлена утечка памяти - все подписки и таймеры очищаются
function useIdleFlag(timeout = 2000) {
    const [ready, setReady] = useState(!isWeb ? true : false);

    useEffect(() => {
        if (!isWeb) return;

        let fired = false;
        let idleHandle: number | null = null;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const arm = () => {
            if (fired) return;
            fired = true;
            setReady(true);
        };

        const cleanup = () => {
            // Очищаем все подписки
            ["scroll", "mousemove", "touchstart", "keydown", "click"].forEach((e) => {
                window.removeEventListener(e, arm, { passive: true } as any);
            });
            
            // Очищаем таймеры
            if (idleHandle && 'cancelIdleCallback' in window) {
                (window as any).cancelIdleCallback(idleHandle);
            }
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        };

        if ("requestIdleCallback" in window) {
            idleHandle = (window as any).requestIdleCallback(arm, { timeout });
        } else {
            timeoutHandle = setTimeout(arm, timeout);
        }

        ["scroll", "mousemove", "touchstart", "keydown", "click"].forEach((e) =>
          window.addEventListener(e, arm, { passive: true, once: true } as any)
        );

        // ✅ FIX-006: Всегда возвращаем cleanup функцию
        return cleanup;
    }, [timeout]);

    return ready;
}

export default function RootLayout() {
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
	    const { width } = useResponsive();
	    const [clientWidth, setClientWidth] = useState<number | null>(null);
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

    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;

      let rafId: number | null = null;
      const update = () => setClientWidth(window.innerWidth);

      // Avoid updating state during React hydration (can trigger React error 421 with Suspense).
      // Defer the initial read to the next frame.
      rafId = window.requestAnimationFrame(() => update());

      window.addEventListener('resize', update);
      return () => {
        if (rafId != null) {
          window.cancelAnimationFrame(rafId);
        }
        window.removeEventListener('resize', update);
      };
    }, []);

    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;
      const metrikaId = (window as any).__metravelMetrikaId;
      if (!metrikaId || typeof (window as any).ym !== 'function') return;
      const url = window.location.href;
      if ((window as any).__metravelLastTrackedUrl === url) return;
      (window as any).__metravelLastTrackedUrl = url;
      try {
        (window as any).ym(metrikaId, 'hit', url, {
          title: document.title,
          referer: document.referrer,
        });
      } catch {
        // noop
      }
      try {
        if ((window as any).gtag && (window as any).__metravelGaId) {
          (window as any).gtag('event', 'page_view', {
            page_title: document.title,
            page_location: url,
          });
        }
      } catch {
        // noop
      }
    }, [pathname]);

	    // ✅ ИСПРАВЛЕНИЕ: Детерминированная ширина на SSR и первом клиентском рендере.
	    // На web `useResponsive()` может сразу вернуть реальную ширину на клиенте,
	    // но на SSR она всегда 0, что приводит к разному дереву и hydration mismatch.
	    // Поэтому до маунта используем только `clientWidth` (null/0), а после эффекта
	    // она обновится и UI адаптируется уже после гидрации.
	    const effectiveWidth = Platform.OS === 'web' ? (clientWidth ?? 0) : width;
    // Важно: на SSR/первом клиентском рендере effectiveWidth может быть 0.
    // Делаем детерминированное значение (не читаем window в рендере), чтобы избежать hydration mismatch.
    const isMobile =
      Platform.OS !== "web"
        ? true
        : effectiveWidth > 0
          ? effectiveWidth < DESIGN_TOKENS.breakpoints.mobile
          : false;


    const showFooter = useMemo(
      () => {
        const p = pathname || "";
        if (["/login", "/onboarding"].includes(p)) return false;
        // On travel create/edit wizard we render our own bottom actions footer.
        // The global mobile dock would overlap it.
        // if (p.startsWith('/travel')) return false;
        return true;
      },
      [pathname]
    );

    useIdleFlag(1200);

    /** === динамическая высота ДОКА футера (только иконки) === */
    const [dockHeight, setDockHeight] = useState(0);
    
    /** === SSR-safe Toast: рендерим только на клиенте === */
    const [isMounted, setIsMounted] = useState(false);
    const [showConsentBanner, setShowConsentBanner] = useState(false);
    
    useEffect(() => {
        let mountedTimer: ReturnType<typeof setTimeout> | null = null;
        let consentTimer: ReturnType<typeof setTimeout> | null = null;

        // Defer mount-only UI to avoid hydration-time updates (React error 421 with Suspense).
        mountedTimer = setTimeout(() => setIsMounted(true), 0);

        // Відкладаємо ConsentBanner на 2 секунди для покращення FCP/LCP
        consentTimer = setTimeout(() => setShowConsentBanner(true), 2000);

        return () => {
          if (mountedTimer) clearTimeout(mountedTimer);
          if (consentTimer) clearTimeout(consentTimer);
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

    useEffect(() => {
      if (!isWeb) return;
      const onUnhandled = (e: PromiseRejectionEvent) => {
        const reason = (e as any)?.reason;
        const msg = String(reason?.message ?? reason ?? '');
        const stack = typeof reason?.stack === 'string' ? reason.stack : '';

        // On web, font loading (expo-font / FontFaceObserver) can reject with timeout exceeded.
        // Do not let this crash the app.
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
      return () => window.removeEventListener('unhandledrejection', onUnhandled);
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

    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;
      
      const isProd = window.location.hostname === 'metravel.by' || window.location.hostname === 'www.metravel.by';
      if (!isProd) return;

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js', { updateViaCache: 'none' as any })
            .then((registration) => {
              // Ensure we check for an updated SW as soon as possible.
              registration.update().catch(() => {});
            })
            .catch(() => {});
        });
      }
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

  const mapBackground = require("../assets/travel/roulette-map-bg.jpg");
  const WEB_FOOTER_RESERVE_HEIGHT = 56;

  const BottomGutter = () => {
    if (!showFooter || !isMobile) return null;

    if (Platform.OS === 'web') {
      return <View testID="bottom-gutter" style={{ height: WEB_FOOTER_RESERVE_HEIGHT }} />;
    }

    const h = dockHeight;
    if (h <= 0) return null;

    return <View testID="bottom-gutter" style={{ height: h }} />;
  };

  return (
    <ThemedPaperProvider>
              <AuthProvider>
                    <FavoritesProvider>
                      <QueryClientProvider client={queryClient}>
                        <FiltersProvider>
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
	                                  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	                                  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	                                  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	                              </Head>

                              {/* ✅ УЛУЧШЕНИЕ: Skip links для доступности */}
                              {Platform.OS === 'web' && <SkipLinks />}

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
                                  <BottomGutter />
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
                                  <React.Suspense fallback={null}>
                                    <FooterLazy
                                      /** Получаем высоту док-строки (мобайл). На десктопе придёт 0. */
                                      onDockHeight={(h) => setDockHeight(h)}
                                    />
                                  </React.Suspense>
                                </View>
                              )}
                        </View>
                        </FiltersProvider>
                      </QueryClientProvider>
                    </FavoritesProvider>
            </AuthProvider>
            {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
            {isMounted && (
              <React.Suspense fallback={null}>
                <ToastLazy />
              </React.Suspense>
            )}
        </ThemedPaperProvider>
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
              height: '100vh',
              maxHeight: '100vh',
              overflow: 'hidden',
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
              overflow: 'hidden',
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
