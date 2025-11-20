import "@expo/metro-runtime";
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { MD3LightTheme as DefaultTheme, PaperProvider } from "react-native-paper";
import { SplashScreen, Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import Toast from "react-native-toast-message";
import { FiltersProvider } from "@/providers/FiltersProvider";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import SkipLinks from "@/components/SkipLinks";
import { NetworkStatus } from "@/components/NetworkStatus";
import { useFonts } from "expo-font";
import { DESIGN_TOKENS } from "@/constants/designSystem"; // ✅ ИСПРАВЛЕНИЕ: Импорт единой палитры

const Footer = lazy(() => import("@/components/Footer"));

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

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
                // ✅ ИСПРАВЛЕНИЕ: Не повторяем запросы при сетевых ошибках или 4xx ошибках
                if (failureCount >= 2) return false;
                
                // Не повторяем при ошибках клиента (4xx)
                if (error?.status >= 400 && error?.status < 500) {
                    return false;
                }
                
                // Повторяем только при сетевых ошибках или ошибках сервера
                return true;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // ✅ FIX: keepPreviousData заменен на placeholderData в React Query v5
            placeholderData: (previousData) => previousData,
            // ✅ ИСПРАВЛЕНИЕ: Обработка ошибок в запросах
            onError: (error: any) => {
                if (__DEV__) {
                    console.error('[QueryClient] Query error:', error);
                }
            },
        },
        mutations: {
            // ✅ ИСПРАВЛЕНИЕ: Обработка ошибок в мутациях
            onError: (error: any) => {
                if (__DEV__) {
                    console.error('[QueryClient] Mutation error:', error);
                }
            },
            retry: false, // Мутации не повторяем автоматически
        },
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
    const isMobile = width <= 900 || Platform.OS !== "web";

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || "https://metravel.by";
    const canonical = `${SITE}${pathname || "/"}`;

    const showFooter = useMemo(
      () => !["/login", "/onboarding"].includes(pathname || ""),
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

    const BottomGutter = () =>
      showFooter && isMobile && dockHeight > 0 ? <View style={{ height: dockHeight}} /> : null;

    const [fontsLoaded, fontError] = useFonts({
      SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
      "Roboto-Regular": require("../assets/fonts/Roboto-Regular.ttf"),
      "Roboto-Medium": require("../assets/fonts/Roboto-Medium.ttf"),
    });

    useEffect(() => {
      if (fontError) {
        console.error("Font loading error:", fontError);
      }
    }, [fontError]);

    if (!fontsLoaded) {
      return (
        <View style={styles.fontLoader}>
          <ActivityIndicator size="small" color="#ff9f5a" />
        </View>
      );
    }

    return (
      <ErrorBoundary>
        <PaperProvider theme={theme}>
            <AuthProvider>
                <FavoritesProvider>
                    <QueryClientProvider client={queryClient}>
                        <FiltersProvider>
                            <View style={styles.container}>
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

                            {showFooter && (
                              <Suspense
                                fallback={
                                    <View style={styles.footerFallback}>
                                        <ActivityIndicator size="small" />
                                    </View>
                                }
                              >
                                {idleReady ? (
                                  <Footer
                                    /** Получаем высоту док-строки (мобайл). На десктопе придёт 0. */
                                    onDockHeight={(h) => setDockHeight(h)}
                                  />
                                ) : null}
                            </Suspense>
                          )}
                      </View>
                  </FiltersProvider>
              </QueryClientProvider>
          </FavoritesProvider>
          </AuthProvider>
          {/* ✅ FIX: Toast рендерится только на клиенте для избежания SSR warning */}
          {isMounted && <Toast />}
          {/* ✅ УЛУЧШЕНИЕ: Мониторинг производительности для production */}
          {/* Метрики скрыты, но собираются в фоне. Чтобы показать, установите showUI={true} */}
          <PerformanceMonitor enabled={true} showUI={false} />
      </PaperProvider>
      </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f6f7fb" },
    content: { flex: 1 },
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
        backgroundColor: "#f6f7fb",
    },
});
