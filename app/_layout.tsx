import "@expo/metro-runtime";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, LogBox } from "react-native";
import { MD3LightTheme as DefaultTheme, PaperProvider } from "react-native-paper";
import { SplashScreen, Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import Toast from "react-native-toast-message";
import { FiltersProvider } from "@/providers/FiltersProvider";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import SkipLinks from "@/components/SkipLinks";
import { NetworkStatus } from "@/components/NetworkStatus";
import ConsentBanner from "@/components/ConsentBanner";
import Footer from "@/components/Footer";
import { useFonts } from "expo-font";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { DESIGN_TOKENS } from "@/constants/designSystem"; 
import { useResponsive } from "@/hooks/useResponsive"; 
import { createOptimizedQueryClient } from "@/src/utils/reactQueryConfig";

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

/** Тема */
// ✅ ИСПРАВЛЕНИЕ: Унифицирована цветовая палитра - используется DESIGN_TOKENS
const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: DESIGN_TOKENS.colors.primary, // ✅ Бирюзовый (#4a8c8c) вместо оранжевого
        secondary: DESIGN_TOKENS.colors.accent,
        background: DESIGN_TOKENS.colors.background,
        surface: DESIGN_TOKENS.colors.surface,
        error: DESIGN_TOKENS.colors.danger,
        outline: DESIGN_TOKENS.colors.border,
        onPrimary: DESIGN_TOKENS.colors.surface, // Белый текст на primary фоне
        onSecondary: DESIGN_TOKENS.colors.text,
    },
    fonts: { ...DefaultTheme.fonts },
} as const;

const queryClient = createOptimizedQueryClient({
    mutations: {
        retry: false,
    },
});

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
    const { width } = useResponsive();
    const [clientWidth, setClientWidth] = useState<number | null>(null);

    useEffect(() => {
      if (!isWeb) return;
      if (typeof window === 'undefined') return;

      const update = () => setClientWidth(window.innerWidth);
      update();

      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }, []);

    // ✅ ИСПРАВЛЕНИЕ: Используем единый breakpoint из DESIGN_TOKENS
    // На web useResponsive() обрабатывает SSR и возвращает корректную ширину.
    const effectiveWidth =
      Platform.OS === 'web'
        ? width === 0
          ? (clientWidth ?? 0)
          : width
        : width;
    // Важно: на SSR/первом клиентском рендере effectiveWidth может быть 0.
    // Делаем детерминированное значение (не читаем window в рендере), чтобы избежать hydration mismatch.
    const isMobile =
      Platform.OS !== "web"
        ? true
        : effectiveWidth > 0
          ? effectiveWidth < DESIGN_TOKENS.breakpoints.mobile
          : false;

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || "https://metravel.by";
    const canonical = `${SITE}${pathname || "/"}`;

    const showFooter = useMemo(
      () => {
        const p = pathname || "";
        if (["/login", "/onboarding"].includes(p)) return false;
        // On travel create/edit wizard we render our own bottom actions footer.
        // The global mobile dock would overlap it.
        // TODO: re-enable this guard if the footer dock is restored.
        // if (p.startsWith('/travel')) return false;
        return true;
      },
      [pathname]
    );

    useIdleFlag(1200);
    const defaultTitle = "MeTravel — путешествия и маршруты";
    const defaultDescription = "Маршруты, места и впечатления от путешественников.";

    const WEB_FOOTER_RESERVE_HEIGHT = 56;

    /** === динамическая высота ДОКА футера (только иконки) === */
    const [dockHeight, setDockHeight] = useState(0);
    
    /** === SSR-safe Toast: рендерим только на клиенте === */
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // На web футер-док находится в потоке (position: sticky), поэтому дополнительная прокладка
    // приводит к поздним layout shifts при измерении высоты дока.
    // Прокладку используем только на native, где док может перекрывать контент.
    const BottomGutter = () => {
      if (!showFooter || !isMobile) return null;

      // On web mobile the footer dock is position: fixed and can overlap content.
      // Reserve deterministic space using a deterministic height to avoid late layout shifts.
      if (isWeb) {
        return <View testID="bottom-gutter" style={{ height: WEB_FOOTER_RESERVE_HEIGHT }} />;
      }

      const h = dockHeight;
      if (h <= 0) return null;

      return <View testID="bottom-gutter" style={{ height: h }} />;
    };

    // Fonts:
    // - On native we must load app fonts before rendering.
    // - On web we do not load fonts via expo-font here. @expo/vector-icons manages its own
    //   web font injection; attempting to load via expo-font can cause timeouts and missing glyphs.
    const [fontsLoaded, fontError] = useFonts(
      isWeb
        ? {}
        : {
            SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
            "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
            "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
            ...(Feather as any).font,
            ...(FontAwesome5 as any).font,
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

    if (!fontsLoaded && !isWeb) {
      return (
        <View style={styles.fontLoader}>
          <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.primary} />
        </View>
      );
    }

    // Фоновая карта для бумажного стиля (используем только на спец-экранах)
    const mapBackground = require("../assets/travel/roulette-map-bg.jpg");

    // Показываем фон-карту только на экранах рулетки, на остальных страницах сохраняем чистый белый фон
    // На мобильном web фон мешает доку/контенту — отключаем.
    const showMapBackground =
      Platform.OS === 'web' &&
      !isMobile &&
      (pathname?.includes('roulette') || pathname?.includes('random'));

    return (
      <ErrorBoundary>
        <PaperProvider theme={theme}>
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
                                <title key="fallback-title">{defaultTitle}</title>
                                <meta key="fallback-description" name="description" content={defaultDescription} />
                                <link key="fallback-canonical" rel="canonical" href={canonical} />
                                {/* Оптимизация шрифтов - font-display: swap уже в +html.tsx */}
                                {Platform.OS === 'web' && (
                                    <>
                                        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
                                        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
                                    </>
                                )}
                            </Head>

                            {/* ✅ УЛУЧШЕНИЕ: Skip links для доступности */}
                            {Platform.OS === 'web' && <SkipLinks />}

                            {/* ✅ FIX-005: Индикатор статуса сети */}
                            <NetworkStatus position="top" />

                            <View style={[styles.content]}>
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                </Stack>

                                {/* Прокладка: только высота док-строки футера */}
                                <BottomGutter />
                            </View>

                            {/* Баннер согласия с компактным интерфейсом (web only) */}
                            <ConsentBanner />

                            {showFooter && (!isWeb || isMounted) && (
                              <View style={[styles.footerWrapper, isWeb && isMobile ? ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 } as any) : null]}>
                                <Footer
                                  /** Получаем высоту док-строки (мобайл). На десктопе придёт 0. */
                                  onDockHeight={(h) => setDockHeight(h)}
                                />
                              </View>
                            )}
                      </View>
                  </FiltersProvider>
              </QueryClientProvider>
          </FavoritesProvider>
          </AuthProvider>
          {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
          {isMounted && <Toast />}
      </PaperProvider>
      </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
        flexDirection: 'column',
        // Белый корневой фон: отключаем просвечивание фоновой карты
        backgroundColor: DESIGN_TOKENS.colors.background,
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
        backgroundColor: "#1f1f1f",
    },
    fontLoader: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        // Оставляем мягкий светлый фон для экрана загрузки шрифтов
        backgroundColor: DESIGN_TOKENS.colors.background,
    },
});
