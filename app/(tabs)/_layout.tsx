// TabLayout.tsx — кастомный header + полный офф таббара
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { Platform, View, Animated } from 'react-native';
import { Tabs, usePathname } from 'expo-router';

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

const CustomHeaderLazy = safeLazy(() => import('@/components/layout/CustomHeader'), 'CustomHeader');
const ScrollToTopButtonLazy = safeLazy(() => import('@/components/ui/ScrollToTopButton'), 'ScrollToTopButton');

const TRAVEL_CHROME_REVEAL_TIMEOUT_MS = 2800;

function useDeferredTravelChrome(isTravelDetailsRoute: boolean) {
    const [isVisible, setIsVisible] = useState(Platform.OS !== 'web' || !isTravelDetailsRoute);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            setIsVisible(true);
            return;
        }

        if (!isTravelDetailsRoute) {
            setIsVisible(true);
            return;
        }

        setIsVisible(false);

        if (typeof window === 'undefined') return;

        let revealed = false;
        let revealTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (revealed) return;
            revealed = true;
            setIsVisible(true);
        }, TRAVEL_CHROME_REVEAL_TIMEOUT_MS);

        const reveal = () => {
            if (revealed) return;
            revealed = true;
            if (revealTimer) {
                clearTimeout(revealTimer);
                revealTimer = null;
            }
            setIsVisible(true);
        };

        window.addEventListener('pointerdown', reveal, { passive: true, once: true });
        window.addEventListener('keydown', reveal, { once: true });
        window.addEventListener('scroll', reveal, { passive: true, once: true });

        return () => {
            revealed = true;
            if (revealTimer) clearTimeout(revealTimer);
            window.removeEventListener('pointerdown', reveal as EventListener);
            window.removeEventListener('keydown', reveal as EventListener);
            window.removeEventListener('scroll', reveal as EventListener);
        };
    }, [isTravelDetailsRoute]);

    return isVisible;
}

const GlobalScrollToTop = React.memo(function GlobalScrollToTop() {
    const pathname = usePathname();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(false);
    const isTravelDetailsRoute =
      typeof pathname === 'string' && pathname.startsWith('/travels/');

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        if (isTravelDetailsRoute) return;
        setMounted(true);
        const handler = () => scrollY.setValue(window.scrollY);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, [isTravelDetailsRoute, scrollY]);

    const isTravelUpsert =
      pathname === '/travel/new' || (typeof pathname === 'string' && /^\/travel\/[^/]+$/.test(pathname));

    if (Platform.OS !== 'web' || !mounted || isTravelUpsert || isTravelDetailsRoute) return null;

    return (
        <React.Suspense fallback={null}>
            <ScrollToTopButtonLazy scrollY={scrollY} threshold={400} />
        </React.Suspense>
    );
});

const Header = React.memo(function Header() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(Platform.OS !== 'web');
    const [measuredHeight, setMeasuredHeight] = useState<number>(0);
    const isTravelDetailsRoute =
      typeof pathname === 'string' && pathname.startsWith('/travels/');
    const showHeader = useDeferredTravelChrome(isTravelDetailsRoute);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        setMounted(true);
    }, []);

    const handleHeaderHeight = useCallback((h: number) => {
        if (h > 0) setMeasuredHeight(h);
    }, []);

    // Reserve stable header space on web to avoid CLS during hydration / icon font swap.
    const reservedHeight = 88;
    if (Platform.OS === 'web') {
        return (
            <View style={{ height: measuredHeight > 0 ? measuredHeight : reservedHeight }}>
                {mounted && showHeader ? (
                  <React.Suspense fallback={null}>
                    <CustomHeaderLazy onHeightChange={handleHeaderHeight} />
                  </React.Suspense>
                ) : null}
            </View>
        );
    }

    return (
      <React.Suspense fallback={null}>
        <CustomHeaderLazy />
      </React.Suspense>
    );
});

// Поведение href:
// - null      -> экран исключён из линкинга (скрыт полностью)
// - undefined -> экран адресуем, но скрыт из таббара
const HIDDEN = { title: '', href: undefined, lazy: true } as const;
const HIDDEN_NOHREF = { title: '', href: null, lazy: true } as const;

export default function TabLayout() {
    const tabBarHiddenStyle = useMemo(() => ({ display: 'none' as const }), []);
    const travelDetailsOptions =
      Platform.OS === 'web'
        ? { title: '', href: undefined, lazy: true }
        : { ...HIDDEN, lazy: false, freezeOnBlur: false };

    return (
        <>
            <Tabs
                tabBar={() => null}
                screenOptions={{
                    tabBarStyle: tabBarHiddenStyle,
                    header: () => <Header />, // кастомный заголовок
                    lazy: true,               // экраны создаются по первому фокусу
                    freezeOnBlur: false,      // не замораживаем экраны при потере фокуса
                }}
            >
                <Tabs.Screen name="index" />
                <Tabs.Screen name="search" options={HIDDEN} />

                {/* адресуемые, но скрытые в таббаре */}
                <Tabs.Screen name="travelsby" options={HIDDEN} />
                <Tabs.Screen name="map" options={HIDDEN} />
                <Tabs.Screen name="roulette" options={HIDDEN} />
                <Tabs.Screen name="favorites" options={HIDDEN} />
                <Tabs.Screen name="history" options={HIDDEN} />
                <Tabs.Screen name="settings" options={HIDDEN} />
                <Tabs.Screen name="userpoints" options={HIDDEN} />
                <Tabs.Screen name="messages" options={HIDDEN} />
                <Tabs.Screen name="subscriptions" options={HIDDEN} />
                <Tabs.Screen name="travels/[param]" options={travelDetailsOptions} />
                <Tabs.Screen name="user/[id]" options={HIDDEN} />

                {/* полностью скрытые из линкинга */}
                <Tabs.Screen name="about" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="login" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="registration" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="set-password" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="travel/new" options={HIDDEN} />
                <Tabs.Screen name="travel/[id]" options={HIDDEN} />
                <Tabs.Screen name="metravel" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="profile" options={HIDDEN_NOHREF} />
                <Tabs.Screen name="accountconfirmation" options={HIDDEN_NOHREF} />
            </Tabs>
            <GlobalScrollToTop />
        </>
    );
}
