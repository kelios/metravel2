import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StatusBar as RNStatusBar, StyleSheet, View, LogBox, useColorScheme, useWindowDimensions } from "react-native";
import { SplashScreen, Stack, usePathname } from "expo-router";
import AppProviders from "@/components/layout/AppProviders";
import NativeAppRuntime from "@/components/layout/NativeAppRuntime";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

/** ===== Helpers ===== */
const isWeb = Platform.OS === "web";

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

const SyncIndicatorLazy: React.LazyExoticComponent<React.ComponentType<any>> | null = !isWeb
  ? safeLazy(
      () => import('@/components/ui/SyncIndicator').then(m => {
        const Component = m.SyncIndicator ?? (m as any).default;
        if (!Component) throw new Error('SyncIndicator export not found');
        return { default: Component };
      }),
      'SyncIndicator'
    )
  : null;
const ReactQueryDevtoolsLazy: any = __DEV__
  ? React.lazy(() =>
      import('@tanstack/react-query-devtools').then((m: any) => ({ default: m.ReactQueryDevtools }))
    )
  : null;
const ToastLazy: React.LazyExoticComponent<React.ComponentType<any>> | null = !isWeb
  ? safeLazy(() => import('@/components/ui/ToastHost'), 'ToastHost')
  : null;
const RootWebDeferredChromeLazy = safeLazy(
  () => import('@/components/layout/RootWebDeferredChrome'),
  'RootWebDeferredChrome'
);
import { DESIGN_TOKENS } from "@/constants/designSystem"; 
import { createOptimizedQueryClient } from "@/utils/reactQueryConfig";
import { patchWebShadowStyles } from "@/utils/patchWebShadowStyles";
import { ThemeProvider, useThemedColors, getThemedColors } from "@/hooks/useTheme";

if (__DEV__) {
  require("@expo/metro-runtime");
}

// ✅ ИСПРАВЛЕНИЕ: Глобальный CSS для web (box-sizing fix)
if (Platform.OS === 'web') {
  require('./global.css');
  patchWebShadowStyles();
}

// useLayoutEffect warning is suppressed by the inline script in +html.tsx

// Подавляем внешние депрекейшн-варнинги от зависимостей (react-native-element-dropdown)
LogBox.ignoreLogs([
  'TouchableWithoutFeedback is deprecated. Please use Pressable.',
  'Image: style.tintColor is deprecated. Please use props.tintColor.',
]);

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
        void import('@/utils/runtimeConfigDiagnostics')
          .then(async ({ getRuntimeConfigDiagnostics }) => {
            const diagnostics = getRuntimeConfigDiagnostics();
            if (diagnostics.length === 0) return;

            const { devError, devWarn } = await import('@/utils/logger');
            for (const diagnostic of diagnostics) {
              const line = `[Config:${diagnostic.code}] ${diagnostic.message}`;
              if (diagnostic.severity === 'error') {
                devError(line);
              } else {
                devWarn(line);
              }
            }
          })
          .catch(() => undefined);
    }, []);

    return <RootLayoutNav />;
}

function useDeferredRootWebChrome(isTravelRoute: boolean, isMounted: boolean) {
  const [isReady, setIsReady] = useState(!isWeb || !isTravelRoute);

  useEffect(() => {
    if (!isWeb || !isMounted) return;

    if (!isTravelRoute) {
      setIsReady(true);
      return;
    }

    setIsReady(false);

    let revealed = false;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
      }
      setIsReady(true);
    };

    window.addEventListener('pointerdown', reveal, { passive: true, once: true });
    window.addEventListener('keydown', reveal, { once: true });
    window.addEventListener('wheel', reveal, { passive: true, once: true });

    return () => {
      revealed = true;
      if (revealTimer) clearTimeout(revealTimer);
      window.removeEventListener('pointerdown', reveal as EventListener);
      window.removeEventListener('keydown', reveal as EventListener);
      window.removeEventListener('wheel', reveal as EventListener);
    };
  }, [isMounted, isTravelRoute]);

  return isReady;
}

	function RootLayoutNav() {
	    const pathname = usePathname();
	    const colorScheme = useColorScheme();
      const { width } = useWindowDimensions();
      const [isViewportHydrated, setIsViewportHydrated] = useState(!isWeb);
    const loadingColors = useMemo(
      () => getThemedColors(colorScheme === 'dark'),
      [colorScheme],
    );

    // Web analytics page-view tracking is handled centrally in getAnalyticsInlineScript().
    // Keeping additional tracking here duplicates GA/Yandex events on route changes.

    // Root layout only needs a stable mobile/desktop split.
    // While web hydration is not complete we keep desktop layout to avoid mismatch.
    const isMobile =
      Platform.OS !== "web"
        ? true
        : isViewportHydrated
          ? width < DESIGN_TOKENS.breakpoints.mobile
          : false;


    const effectivePathname = useMemo(() => {
      if (typeof pathname === 'string' && pathname.length > 0 && pathname !== '/') {
        return pathname;
      }
      if (isWeb && typeof window !== 'undefined') {
        return window.location?.pathname || pathname || '';
      }
      return pathname || '';
    }, [pathname]);

    const showFooter = useMemo(
      () => {
        const p = effectivePathname || "";
        if (["/login", "/onboarding"].includes(p)) return false;
        // Map page uses full viewport height — footer steals space from the map
        if (p === "/map") return false;
        // On travel create/edit wizard we render our own bottom actions footer.
        // The global mobile dock would overlap it.
        // if (p.startsWith('/travel')) return false;
        return true;
      },
      [effectivePathname]
    );
    const isTravelPerformanceRoute = useMemo(
      () => typeof effectivePathname === 'string' && effectivePathname.startsWith('/travels/'),
      [effectivePathname]
    );

    // ✅ FIX: Создаем queryClient внутри компонента для избежания проблем с SSR/гидрацией
    const [queryClient] = useState(() => createOptimizedQueryClient(
      {
        mutations: {
          retry: false,
        },
      },
      {
        enableStaticPrefetch: !isTravelPerformanceRoute,
      }
    ));

    /** === динамическая высота ДОКА футера (только иконки) === */
    const [dockHeight, setDockHeight] = useState(0);
    
    /** === SSR-safe Toast: рендерим только на клиенте === */
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        if (!isWeb) return;
        setIsViewportHydrated(true);
    }, []);

    useEffect(() => {
        let mountedTimer: ReturnType<typeof setTimeout> | null = null;

        // Defer mount-only UI to avoid hydration-time updates (React error 421 with Suspense).
        mountedTimer = setTimeout(() => setIsMounted(true), 0);

        return () => {
          if (mountedTimer) clearTimeout(mountedTimer);
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

    // AND-06: Hide splash screen only after fonts are loaded (native).
    useEffect(() => {
      if (!isWeb && fontsLoaded) {
        SplashScreen.hideAsync().catch((error) => {
          if (__DEV__) {
            console.warn('[RootLayout] Ошибка hideAsync:', error);
          }
        });
      }
    }, [fontsLoaded]);

    useEffect(() => {
      if (fontError && !isWeb) {
        console.error("Font loading error:", fontError);
      }
    }, [fontError]);

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
            pathname={effectivePathname}
            currentColorScheme={colorScheme}
            dockHeight={dockHeight}
            setDockHeight={setDockHeight}
            isMounted={isMounted}
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
  pathname,
  currentColorScheme,
  dockHeight,
  setDockHeight,
  isMounted,
  queryClient,
}: {
  showMapBackground: boolean;
  showFooter: boolean;
  isMobile: boolean;
  pathname?: string;
  currentColorScheme: 'light' | 'dark' | null | undefined;
  dockHeight: number;
  setDockHeight: (h: number) => void;
  isMounted: boolean;
  queryClient: any;
}) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapBackground = showMapBackground ? require("../assets/travel/roulette-map-bg.jpg") : null;
  const WEB_FOOTER_RESERVE_HEIGHT = 56;
  const isTravelRoute =
    Platform.OS === 'web' &&
    typeof pathname === 'string' &&
    /^\/travels\/[^/]+$/.test(pathname);
  const shouldDeferFavoritesProvider =
    isTravelRoute;
  const shouldDeferAuthProvider =
    isTravelRoute;
  const favoritesDeferMode =
    isTravelRoute ? 'interaction' : 'idle';
  const authDeferMode =
    isTravelRoute ? 'interaction' : 'idle';
  const showRootWebDeferredChrome = useDeferredRootWebChrome(isTravelRoute, isMounted);

  const bottomGutter = useMemo(() => {
    if (!showFooter || !isMobile) return null;

    if (Platform.OS === 'web') {
      return <View testID="bottom-gutter" style={{ height: WEB_FOOTER_RESERVE_HEIGHT }} />;
    }

    if (dockHeight <= 0) return null;

    return <View testID="bottom-gutter" style={{ height: dockHeight }} />;
  }, [showFooter, isMobile, dockHeight]);

  return (
    <AppProviders
      queryClient={queryClient}
      deferAuthProvider={shouldDeferAuthProvider}
      authDeferMode={authDeferMode}
      deferFavoritesProvider={shouldDeferFavoritesProvider}
      favoritesDeferMode={favoritesDeferMode}
    >
                          <NativeAppRuntime />
                          {/* AND-08: Global StatusBar — syncs barStyle with current theme (native only) */}
                          {Platform.OS !== 'web' && (
                            <RNStatusBar
                              barStyle={currentColorScheme === 'dark' ? 'light-content' : 'dark-content'}
                              backgroundColor="transparent"
                              translucent
                            />
                          )}
                          <View style={styles.container}>
                              {showMapBackground && (
                                <Image
                                  source={mapBackground}
                                  style={styles.backgroundImage}
                                  resizeMode="cover"
                                />
                              )}

                              {/* AND-10: Индикатор синхронизации при восстановлении сети (native only) */}
                              {!isWeb && (
                                <React.Suspense fallback={null}>
                                  <SyncIndicatorLazy />
                                </React.Suspense>
                              )}

                              <View style={[styles.content]}>
                                  <Stack screenOptions={{ headerShown: false }}>
                                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                  </Stack>

                                  {/* Прокладка: только высота док-строки футера */}
                                  {bottomGutter}
                              </View>

                              {Platform.OS === 'web' && __DEV__ && ReactQueryDevtoolsLazy ? (
                                <React.Suspense fallback={null}>
                                  <ReactQueryDevtoolsLazy initialIsOpen={false} />
                                </React.Suspense>
                              ) : null}

                              {isWeb && isMounted && showRootWebDeferredChrome && (
                                <React.Suspense fallback={null}>
                                  <RootWebDeferredChromeLazy
                                    isMobile={isMobile}
                                    pathname={pathname}
                                    showFooter={showFooter}
                                    isTravelPerformanceRoute={isTravelRoute}
                                    setDockHeight={setDockHeight}
                                  />
                                </React.Suspense>
                              )}
                        </View>
            {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
            {!isWeb && isMounted && (
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
