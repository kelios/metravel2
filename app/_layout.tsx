import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StatusBar as RNStatusBar, StyleSheet, View, LogBox, useColorScheme, useWindowDimensions } from "react-native";
import { SplashScreen, Stack, usePathname } from "expo-router";
import AppProviders from "@/components/layout/AppProviders";
import NativeAppRuntime from "@/components/layout/NativeAppRuntime";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import {
  NativeFooterComponent,
  ReactQueryDevtoolsComponent,
  RootWebDeferredChromeComponent,
  SyncIndicatorComponent,
  ToastComponent,
} from "@/components/layout/rootRuntimeComponents";

/** ===== Helpers ===== */
const isWeb = Platform.OS === "web";

// На native нижний док (Footer → BottomDock) не входит в web-only chrome — рендерим отдельно
// ВНИМАНИЕ (verify pending, dev-client 2026-06-11): GestureHandlerRootView в корне на текущем
// Android dev-client рендерится как ReactUnimplementedView (Fabric-дескриптор RNGH RootView
// отсутствует в нативной сборке) → чёрный экран. До пересборки dev-client с проверенным RNGH
// корень остаётся обычным View; Gorhom-шит «Ещё» в BottomDock не монтируется (см. BottomDock).
const RootContainerView: React.ComponentType<any> = View;
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { createOptimizedQueryClient } from "@/utils/reactQueryConfig";
import { patchWebShadowStyles } from "@/utils/patchWebShadowStyles";
import { installChunkErrorReloadHandler } from "@/utils/chunkReload";
import { ThemeProvider, useThemedColors, getThemedColors } from "@/hooks/useTheme";
import { shouldRunRuntimeConfigDiagnostics } from '@/utils/runtimeConfigDiagnostics';

if (__DEV__) {
  require("@expo/metro-runtime");
}

// ✅ ИСПРАВЛЕНИЕ: Глобальный CSS для web (box-sizing fix)
if (Platform.OS === 'web') {
  require('./global.css');
  patchWebShadowStyles();
  // Recover from blank pages when navigating after a new deploy: asyncRoutes
  // splits every web route into a hashed chunk, and a stale client requesting a
  // now-missing chunk would otherwise hang on a blank screen.
  installChunkErrorReloadHandler();
}

// useLayoutEffect warning is suppressed by the inline script in +html.tsx

// Подавляем внешние депрекейшн-варнинги от зависимостей (react-native-element-dropdown)
LogBox.ignoreLogs([
  'TouchableWithoutFeedback is deprecated. Please use Pressable.',
  'Image: style.tintColor is deprecated. Please use props.tintColor.',
]);

// Upstream-артефакт expo-router asyncRoutes (native dev): asyncRequire пробует sync importAll
// ДО fetch'а route-чанка ("try importing first"), guardedLoadModule репортит этот ожидаемый
// промах как fatal через ErrorUtils → красный LogBox на каждый layout при старте. Чанк затем
// догружается, маршруты работают. Прячем только из LogBox (в терминале Metro ошибки видны).
// Правильный фикс — asyncRoutes: { web: true, default: false } в app.json (protected file).
if (!isWeb) {
  LogBox.ignoreLogs([/Requiring unknown module/]);
}

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
        if (!shouldRunRuntimeConfigDiagnostics({
          isDev: __DEV__,
          isWeb,
          hostname: isWeb && typeof window !== 'undefined' ? window.location?.hostname : null,
          pathname: isWeb && typeof window !== 'undefined' ? window.location?.pathname : null,
        })) return;
        void Promise.resolve(import('@/utils/runtimeConfigDiagnostics'))
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
  const [isReady, setIsReady] = useState(() => !isWeb || !isMounted || !isTravelRoute);

  useEffect(() => {
    if (!isWeb) {
      setIsReady(true);
      return;
    }
    if (!isMounted) return;
    if (!isTravelRoute) {
      setIsReady(true);
      return;
    }

    setIsReady(false);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;
      setIsReady(true);
    };

    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(reveal, { timeout: 250 });
    }
    timeoutId = setTimeout(reveal, 250);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null) {
        try {
          ;(window as any).cancelIdleCallback(idleId);
        } catch {
          // noop
        }
      }
    };
  }, [isMounted, isTravelRoute]);

  return isReady;
}

	function RootLayoutNav() {
	    const pathname = usePathname();
	    const colorSchemeRaw = useColorScheme();
	    const colorScheme = colorSchemeRaw === 'unspecified' ? null : colorSchemeRaw;
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


    // usePathname() is the reactive source of truth and re-runs this memo on every
    // client-side navigation. The window.location fallback is intentionally only a
    // first-frame/SSR safety net for when expo-router has not resolved pathname yet
    // (empty or '/'); it is not a reactive input, so it is deliberately omitted from
    // deps. Once pathname is populated the fallback branch is never taken again.
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
        if (p === "/login") return false;
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
    //
    // NOTE: enableStaticPrefetch is a one-shot flag — createOptimizedQueryClient()
    // consumes it synchronously at creation time and schedules a single idle-time
    // static prefetch (filters/countries) for the QueryClient's whole lifetime.
    // It is NOT a per-route toggle, so freezing it under the initial route here is
    // harmless: it only decides whether that single startup prefetch runs, and on a
    // travel-detail entry route we (correctly) skip the static prefetch once.
    // Reading isTravelPerformanceRoute dynamically would not change behavior unless
    // the util were refactored to re-evaluate prefetch per navigation (a getter/ref
    // contract change), which is out of scope for this bootstrap fix.
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
    // - On native we only load the icon font (Feather) used across the UI.
    //   Text uses the platform system font (San Francisco / Roboto), so no custom
    //   text faces are bundled — fewer weights to download/parse, faster first paint.
    // - On web we do not load fonts via expo-font here. @expo/vector-icons manages its own
    //   web font injection; attempting to load via expo-font can cause timeouts and missing glyphs.
    const [fontsLoaded, fontError] = useAppFonts(
      isWeb
        ? {}
        : {
            ...(require('@expo/vector-icons/Feather') as any).font,
          }
    );

    // Старт не должен висеть на шрифтах: после таймаута показываем UI с системными глифами.
    const [fontWaitExpired, setFontWaitExpired] = useState(isWeb);
    useEffect(() => {
      if (isWeb || fontsLoaded || fontError) return;
      const t = setTimeout(() => setFontWaitExpired(true), 3000);
      return () => clearTimeout(t);
    }, [fontsLoaded, fontError]);

    // AND-06: Hide splash screen after fonts are loaded OR failed to load (native).
    // Gating on fontsLoaded alone hangs the start when fontError occurs
    // (fontsLoaded stays false), so the splash/spinner never hides.
    useEffect(() => {
      if (!isWeb && (fontsLoaded || fontError || fontWaitExpired)) {
        SplashScreen.hideAsync().catch((error) => {
          if (__DEV__) {
            console.warn('[RootLayout] Ошибка hideAsync:', error);
          }
        });
      }
    }, [fontsLoaded, fontError, fontWaitExpired]);

    useEffect(() => {
      if (fontError && !isWeb) {
        console.error("Font loading error:", fontError);
      }
    }, [fontError]);

    if (!fontsLoaded && !fontError && !isWeb && !fontWaitExpired) {
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
  const isMapRoute =
    Platform.OS === 'web' &&
    typeof pathname === 'string' &&
    (pathname === '/map' || pathname.startsWith('/map/'));
  // Travel details defer several below-the-fold/runtime widgets already.
  // Deferring the root auth/favorites providers swaps fallback contexts for
  // real providers after first interaction, which remounts the entire route
  // subtree and visibly replays the page skeleton on travel pages.
  const shouldDeferFavoritesProvider = false;
  const shouldDeferAuthProvider = false;
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
                          <RootContainerView style={styles.container}>
                              {showMapBackground && (
                                <Image
                                  source={mapBackground}
                                  style={styles.backgroundImage}
                                  resizeMode="cover"
                                />
                              )}

                              {/* AND-10: Индикатор синхронизации при восстановлении сети (native only) */}
                              {!isWeb && SyncIndicatorComponent && (
                                <SyncIndicatorComponent />
                              )}

                              <View style={[styles.content]}>
                                  <Stack screenOptions={{ headerShown: false }}>
                                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                  </Stack>

                                  {/* Прокладка: только высота док-строки футера */}
                                  {bottomGutter}
                              </View>

                              {Platform.OS === 'web' && __DEV__ && !isMobile && !isTravelRoute && !isMapRoute && ReactQueryDevtoolsComponent ? (
                                <React.Suspense fallback={null}>
                                  <ReactQueryDevtoolsComponent initialIsOpen={false} />
                                </React.Suspense>
                              ) : null}

                              {isWeb && isMounted && showRootWebDeferredChrome && RootWebDeferredChromeComponent && (
                                <React.Suspense fallback={null}>
                                  <RootWebDeferredChromeComponent
                                    isMobile={isMobile}
                                    pathname={pathname}
                                    showFooter={showFooter}
                                    isTravelPerformanceRoute={isTravelRoute}
                                    setDockHeight={setDockHeight}
                                  />
                                </React.Suspense>
                              )}

                              {!isWeb && showFooter && NativeFooterComponent && (
                                <NativeFooterComponent />
                              )}
                        </RootContainerView>
            {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
            {!isWeb && isMounted && ToastComponent && (
              <ToastComponent />
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
