// TabLayout.tsx — кастомный header + полный офф таббара
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { Platform, View, Animated } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import CustomHeader from '@/components/layout/CustomHeader';
import { shouldShowHeaderContextBar } from '@/components/layout/customHeaderModel';

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

const ScrollToTopButtonLazy = safeLazy(() => import('@/components/ui/ScrollToTopButton'), 'ScrollToTopButton');

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

const HEADER_MOBILE_BREAKPOINT = 768;
type HeaderVariant = 'mobile-bar' | 'mobile-nobar' | 'desktop-bar' | 'desktop-nobar';

const HEADER_HEIGHT_FALLBACK: Record<HeaderVariant, number> = {
    'mobile-bar': 116,
    'mobile-nobar': 64,
    'desktop-bar': 118,
    'desktop-nobar': 78,
};

const HEADER_HEIGHT_CACHE_KEY: Record<HeaderVariant, string> = {
    'mobile-bar': 'mt:header-height:mobile-bar',
    'mobile-nobar': 'mt:header-height:mobile-nobar',
    'desktop-bar': 'mt:header-height:desktop-bar',
    'desktop-nobar': 'mt:header-height:desktop-nobar',
};

const getHeaderVariant = (pathname: string): HeaderVariant => {
    const isMobile =
        Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.innerWidth < HEADER_MOBILE_BREAKPOINT
            : false;
    const hasBar = shouldShowHeaderContextBar(pathname || '/', isMobile);
    if (isMobile) return hasBar ? 'mobile-bar' : 'mobile-nobar';
    return hasBar ? 'desktop-bar' : 'desktop-nobar';
};

const readCachedHeaderHeight = (variant: HeaderVariant): number => {
    const fallback = HEADER_HEIGHT_FALLBACK[variant];
    if (Platform.OS !== 'web' || typeof window === 'undefined') return fallback;
    try {
        const raw = window.sessionStorage?.getItem(HEADER_HEIGHT_CACHE_KEY[variant]);
        const parsed = raw ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
        /* noop */
    }
    return fallback;
};

const Header = React.memo(function Header() {
    const pathname = usePathname() || '/';
    const [, setVariant] = useState<HeaderVariant>(() => getHeaderVariant(pathname));
    const [measuredHeight, setMeasuredHeight] = useState<number>(() => readCachedHeaderHeight(getHeaderVariant(pathname)));

    useEffect(() => {
        const next = getHeaderVariant(pathname);
        setVariant((prev) => {
            if (prev === next) return prev;
            setMeasuredHeight(readCachedHeaderHeight(next));
            return next;
        });
    }, [pathname]);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        const onResize = () => {
            const next = getHeaderVariant(pathname);
            setVariant((prev) => {
                if (prev === next) return prev;
                setMeasuredHeight(readCachedHeaderHeight(next));
                return next;
            });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [pathname]);

    const handleHeaderHeight = useCallback((h: number) => {
        if (h <= 0) return;
        setMeasuredHeight((prev) => (prev === h ? prev : h));
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
                const v = getHeaderVariant(pathname);
                window.sessionStorage?.setItem(HEADER_HEIGHT_CACHE_KEY[v], String(Math.round(h)));
            } catch {
                /* noop */
            }
        }
    }, [pathname]);

    if (Platform.OS === 'web') {
        return (
            <View style={{ height: measuredHeight }}>
                <CustomHeader onHeightChange={handleHeaderHeight} />
            </View>
        );
    }

    return (
      <CustomHeader />
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
                <Tabs.Screen name="calendar" options={HIDDEN} />
                <Tabs.Screen name="settings" options={HIDDEN} />
                <Tabs.Screen name="userpoints" options={HIDDEN} />
                <Tabs.Screen name="messages" options={HIDDEN} />
                <Tabs.Screen name="subscriptions" options={HIDDEN} />
                <Tabs.Screen name="travels/[param]" options={travelDetailsOptions} />
                <Tabs.Screen name="quests/index" options={HIDDEN} />
                <Tabs.Screen name="quests/map" options={HIDDEN} />
                <Tabs.Screen name="quests/[city]/[questId]" options={HIDDEN} />
                <Tabs.Screen name="user/[id]" options={HIDDEN} />

                {/* полностью скрытые из линкинга */}
                <Tabs.Screen name="about" options={HIDDEN} />
                <Tabs.Screen name="privacy" options={HIDDEN} />
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
