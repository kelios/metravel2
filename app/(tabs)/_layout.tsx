// TabLayout.tsx — кастомный header + полный офф таббара
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
const CustomHeaderLazy = React.lazy(() => import('@/components/CustomHeader'));

const Header = React.memo(function Header() {
    const [mounted, setMounted] = useState(Platform.OS !== 'web');
    const [measuredHeight, setMeasuredHeight] = useState<number>(0);
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
                {mounted ? (
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
    return (
        <Tabs
            initialRouteName="index"
            tabBar={() => null}
            screenOptions={{
                tabBarStyle: tabBarHiddenStyle,
                header: () => <Header />, // кастомный заголовок
                lazy: true,               // экраны создаются по первому фокусу
                freezeOnBlur: true,       // заморозка внефокусных экранов
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
            <Tabs.Screen
              name="travels/[param]"
              options={{ ...HIDDEN, lazy: false, freezeOnBlur: false }}
            />
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
    );
}
