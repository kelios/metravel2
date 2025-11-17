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
import { useFonts } from "expo-font";

const Footer = lazy(() => import("@/components/Footer"));

/** ===== Helpers ===== */
const isWeb = Platform.OS === "web";

/** Тема */
const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: "#ff9f5a",
        secondary: "#ffd28f",
        background: "#f6f7fb",
        surface: "#ffffff",
        error: "#d32f2f",
        outline: "#e6e6e6",
        onPrimary: "#1b1b1b",
        onSecondary: "#1b1b1b",
    },
    fonts: { ...DefaultTheme.fonts },
} as const;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            keepPreviousData: true,
        },
    },
});

/** Splash на native */
if (!isWeb) {
    SplashScreen.preventAutoHideAsync().catch(() => {});
}

/** Хук готовности по бездействию (web) */
function useIdleFlag(timeout = 2000) {
    const [ready, setReady] = useState(!isWeb ? true : false);

    useEffect(() => {
        if (!isWeb) return;

        let fired = false;
        const arm = () => {
            if (fired) return;
            fired = true;
            setReady(true);
            cleanup();
        };

        const cleanup = () => {
            ["scroll", "mousemove", "touchstart", "keydown", "click"].forEach((e) => {
                window.removeEventListener(e, arm, { passive: true } as any);
            });
        };

        if ("requestIdleCallback" in window) {
            (window as any).requestIdleCallback(arm, { timeout });
        } else {
            const t = setTimeout(arm, timeout);
            return () => clearTimeout(t);
        }

        ["scroll", "mousemove", "touchstart", "keydown", "click"].forEach((e) =>
          window.addEventListener(e, arm, { passive: true, once: true } as any)
        );

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
          <Toast />
          {/* Мониторинг производительности (только в dev режиме) */}
          {__DEV__ && <PerformanceMonitor enabled={__DEV__} showUI={false} />}
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
