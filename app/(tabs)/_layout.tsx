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
  // Metro async-require may return a bare thenable (no .catch) for sync-available modules
  Promise.resolve(loader()).catch((err) => {
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

// SSR/первый-рендер вариант: НЕ читаем window/sessionStorage, иначе статический
// HTML (всегда desktop) не совпадёт с первым клиентским рендером → hydration mismatch (#418).
// Реальный вариант/высоту подтягивает useEffect после маунта.
const getStaticHeaderVariant = (pathname: string): HeaderVariant => {
    const hasBar = shouldShowHeaderContextBar(pathname || '/', false);
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

// R-1 — на табе карты прячем глобальную шапку на мобильном (native + web-mobile):
// собственная строка поиска карты («Искать места») должна быть верхним элементом,
// как в Google/Organic Maps. Глобальная шапка дублировала поиск и занимала полосу.
// На desktop-web шапку оставляем: там нет нижнего дока, и nav-бар нужен.
const MAP_HEADER_MOBILE_BREAKPOINT = HEADER_MOBILE_BREAKPOINT;
const isMapRoute = (pathname: string) => pathname === '/map' || pathname.startsWith('/map/');
const shouldHideHeaderForMap = (pathname: string): boolean => {
    if (!isMapRoute(pathname)) return false;
    if (Platform.OS !== 'web') return true;
    if (typeof window === 'undefined') return false; // SSR/desktop snapshot keeps header (no CLS for mobile-only hide)
    return window.innerWidth < MAP_HEADER_MOBILE_BREAKPOINT;
};

const Header = React.memo(function Header() {
    const pathname = usePathname() || '/';
    const [, setVariant] = useState<HeaderVariant>(() => getStaticHeaderVariant(pathname));
    // Mobile-only: re-evaluate header suppression on resize/route so the map tab
    // drops the global header bar once we know the viewport is mobile.
    const [hideForMap, setHideForMap] = useState<boolean>(() => shouldHideHeaderForMap(pathname));
    const [measuredHeight, setMeasuredHeight] = useState<number>(
        () => HEADER_HEIGHT_FALLBACK[getStaticHeaderVariant(pathname)],
    );

    useEffect(() => {
        const next = getHeaderVariant(pathname);
        setVariant(next);
        setMeasuredHeight(readCachedHeaderHeight(next));
        setHideForMap(shouldHideHeaderForMap(pathname));
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
            setHideForMap((prev) => {
                const nextHide = shouldHideHeaderForMap(pathname);
                return prev === nextHide ? prev : nextHide;
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

    // R-1 — на табе карты (мобильный) шапки нет вовсе: ни самой шапки, ни
    // зарезервированной высоты-обёртки, иначе сверху осталась бы пустая «дырка».
    if (hideForMap) return null;

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
    // На native нижний док (BottomDock) использует «Профиль» как ключевую вкладку
    // → роут /profile должен быть адресуем (href: undefined), иначе router.push
    // в доке не сработает. На web профиль остаётся вне линкинга таб-навигатора
    // (href: null), как и было — поведение web не меняем.
    const profileOptions = Platform.OS === 'web' ? HIDDEN_NOHREF : HIDDEN;

    return (
        <>
            <Tabs
                tabBar={() => null}
                // Android hardware Back и router.back() должны возвращать на
                // предыдущий активный таб (напр. Профиль → Настройки → Back → Профиль),
                // а не сбрасывать на первый таб (index). Выход с главной всё ещё
                // обрабатывает useAndroidBackHandler (двойной тап) до этого поведения.
                backBehavior="history"
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
                <Tabs.Screen name="places" options={HIDDEN} />
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
                <Tabs.Screen name="profile" options={profileOptions} />
                <Tabs.Screen name="accountconfirmation" options={HIDDEN_NOHREF} />
            </Tabs>
            <GlobalScrollToTop />
        </>
    );
}
