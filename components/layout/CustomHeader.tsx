import React, { Suspense, useMemo, useRef, lazy } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import Logo from './Logo';
import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { createCustomHeaderStyles, webStickyStyle } from './customHeaderStyles';

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

const HeaderContextBarLazy = lazy(() => import('./HeaderContextBar'));
const CustomHeaderNavSectionComp = isTestEnv
  ? (require('./CustomHeaderNavSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderNavSection'));
const CustomHeaderAccountSectionComp = isTestEnv
  ? (require('./CustomHeaderAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderAccountSection'));
type CustomHeaderProps = {
    onHeightChange?: (height: number) => void;
};

function CustomHeader({ onHeightChange }: CustomHeaderProps) {
    const colors = useThemedColors();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const effectiveWebWidth = useMemo(() => {
        if (Platform.OS !== 'web') return width;
        if (!isTestEnv && typeof window !== 'undefined' && window.innerWidth > 0) {
            return window.innerWidth;
        }
        return width;
    }, [width]);
    // NAV-10: На web-планшете (768–1024px) показываем inline-навигацию вместо бургера.
    // На native планшет остаётся мобильным (бургер + dock).
    const isMobile = useMemo(() => {
        if (Platform.OS === 'web') {
            return effectiveWebWidth < METRICS.breakpoints.tablet;
        }
        return width < METRICS.breakpoints.largeTablet;
    }, [effectiveWebWidth, width]);
    const lastHeightRef = useRef(0);
    const isTravelRoute =
        pathname.startsWith('/travels/') || pathname.startsWith('/travel/');
    const showHeaderContextBar = !(Platform.OS === 'web' && !isMobile && isTravelRoute);
    const showNavSection = true;
    const showAccountSection = true;

    // Определяем активную страницу
    const activePath = useMemo(() => {
        if (pathname === '/' || pathname === '/index') return '/';
        if (pathname.startsWith('/travels/')) return '/search';
        if (pathname.startsWith('/travel/')) return '/search';
        if (pathname.startsWith('/search')) return '/search';
        if (pathname.startsWith('/travelsby')) return '/travelsby';
        if (pathname.startsWith('/export')) return '/export';
        if (pathname.startsWith('/map')) return '/map';
        if (pathname.startsWith('/quests')) return '/quests';
        if (pathname.startsWith('/roulette')) return '/roulette';
        return pathname;
    }, [pathname]);

    const styles = useMemo(
      () => createCustomHeaderStyles(colors, isMobile),
      [colors, isMobile]
    );

    return (
      <View 
        style={[styles.container, webStickyStyle]}
        testID="main-header"
        onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.height);
            if (next > 0 && next !== lastHeightRef.current) {
                lastHeightRef.current = next;
                onHeightChange?.(next);
            }
        }}
      >
          <View style={styles.wrapper}>
              <View style={[styles.inner, isMobile && styles.innerMobile]}>
                  {/* Логотип - слева */}
                  <Logo isCompact={isMobile} showWordmark={!isMobile} />
                  
                  {/* Навигация - в центре, показываем только на десктопе и планшетах */}
                  {!isMobile ? (
                    showNavSection ? (
                      <Suspense fallback={<View style={styles.navScroll} />}>
                        <CustomHeaderNavSectionComp activePath={activePath} styles={styles} />
                      </Suspense>
                    ) : (
                      <View style={styles.navScroll} />
                    )
                  ) : null}
                  
                  {/* Элементы пользователя - справа */}
                  {showAccountSection ? (
                    <Suspense fallback={null}>
                      <CustomHeaderAccountSectionComp
                        activePath={activePath}
                        isMobile={isMobile}
                        styles={styles}
                      />
                    </Suspense>
                  ) : (
                    <View style={styles.rightSection} />
                  )}
              </View>
          
          {showHeaderContextBar ? (
            <Suspense fallback={null}>
              <HeaderContextBarLazy />
            </Suspense>
          ) : null}
          </View>
      </View>
    );
}

export default React.memo(CustomHeader);
