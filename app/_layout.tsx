import "@expo/metro-runtime";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
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
import { DESIGN_TOKENS } from "@/constants/designSystem"; // ✅ ИСПРАВЛЕНИЕ: Импорт единой палитры
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
        if (!isWeb) SplashScreen.hideAsync().catch(() => {});
    }, []);
    return <RootLayoutNav />;
}

function RootLayoutNav() {
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    // ✅ ИСПРАВЛЕНИЕ: Используем единый breakpoint из DESIGN_TOKENS
    const isMobile = width < DESIGN_TOKENS.breakpoints.mobile || Platform.OS !== "web";

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || "https://metravel.by";
    const canonical = `${SITE}${pathname || "/"}`;

    const showFooter = useMemo(
      () => {
        const p = pathname || "";
        if (["/login", "/onboarding"].includes(p)) return false;
        // On travel create/edit wizard we render our own bottom actions footer.
        // The global mobile dock would overlap it.
        if (p.startsWith('/travel') && false) return false;
        return true;
      },
      [pathname]
    );

    const idleReady = useIdleFlag(1200);
    const defaultTitle = "MeTravel — путешествия и маршруты";
    const defaultDescription = "Маршруты, места и впечатления от путешественников.";

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
      // Reserve space equal to the measured dock height (with a small fallback).
      const webFallback = 64;
      const h = isWeb ? (dockHeight > 0 ? dockHeight : webFallback) : dockHeight;

      if (h <= 0) return null;

      return <View testID="bottom-gutter" style={{ height: h }} />;
    };

    // На web шрифты подгружаются через link + font-display: swap, поэтому
    // не блокируем рендер и не дергаем fontfaceobserver (во избежание timeout).
    const [fontsLoaded, fontError] = useFonts(
      isWeb
        ? {}
        : {
            SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
            "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
            "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
          }
    );

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
    const showMapBackground =
      Platform.OS === 'web' && (pathname?.includes('roulette') || pathname?.includes('random'));

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

                            <View style={styles.content}>
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                </Stack>

                                {/* Прокладка: только высота док-строки футера */}
                                <BottomGutter />
                            </View>

                            {/* Баннер согласия с компактным интерфейсом (web only) */}
                            <ConsentBanner />

                            {showFooter && (
                              <View style={styles.footerWrapper}>
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
