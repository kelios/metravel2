import React, { Suspense, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';

import { useThemedColors } from '@/hooks/useTheme';
import useBreadcrumbModel from '@/hooks/useBreadcrumbModel';

import {
  CustomHeaderAccountSectionComp,
  CustomHeaderNavSectionComp,
  HeaderContextBarLazy,
} from './customHeaderLazy';
import {
  getEffectiveHeaderWidth,
  getHeaderActivePath,
  getIsHeaderMobile,
  shouldShowHeaderContextBar,
} from './customHeaderModel';
import { resolveHeaderContextBarAction } from './headerContextBarModel';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { createCustomHeaderStyles, webStickyStyle } from './customHeaderStyles';
import Logo from './Logo';

const TOP_LEVEL_TAB_PATHS = new Set<string>(
  ['/'].concat(HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path)),
);

type CustomHeaderProps = {
    onHeightChange?: (height: number) => void;
};

function CustomHeader({ onHeightChange }: CustomHeaderProps) {
    const colors = useThemedColors();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const effectiveWebWidth = useMemo(() => getEffectiveHeaderWidth(width), [width]);
    const isMobile = useMemo(
      () => getIsHeaderMobile(width, effectiveWebWidth),
      [effectiveWebWidth, width]
    );
    const lastHeightRef = useRef(0);
    const showHeaderContextBar = useMemo(
      () => shouldShowHeaderContextBar(pathname, isMobile),
      [isMobile, pathname]
    );
    const breadcrumbModel = useBreadcrumbModel();
    // Predict whether the lazy HeaderContextBar will actually render visible UI
    // (mirrors the conditions inside HeaderContextBar). When false on desktop,
    // the bar collapses to a hidden JSON-LD only — Suspense must reserve 0px to
    // avoid a 40px layout-shift on routes without breadcrumbs (e.g. home).
    const willRenderVisibleContextBar = useMemo(() => {
      if (!showHeaderContextBar) return false;
      if (isMobile) {
        const action = resolveHeaderContextBarAction(pathname);
        const isTopLevelTab = !!pathname && TOP_LEVEL_TAB_PATHS.has(pathname);
        return !(isTopLevelTab && action === 'none');
      }
      return breadcrumbModel.showBreadcrumbs;
    }, [breadcrumbModel.showBreadcrumbs, isMobile, pathname, showHeaderContextBar]);
    const activePath = useMemo(() => getHeaderActivePath(pathname), [pathname]);

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
                    <Suspense fallback={<View style={styles.navScroll} />}>
                      <CustomHeaderNavSectionComp activePath={activePath} styles={styles} />
                    </Suspense>
                  ) : null}
                  
                  {/* Элементы пользователя - справа */}
                  <Suspense fallback={isMobile ? <View style={styles.rightSection} /> : null}>
                    <CustomHeaderAccountSectionComp
                      activePath={activePath}
                      isMobile={isMobile}
                      styles={styles}
                    />
                  </Suspense>
              </View>
          
          {showHeaderContextBar ? (
            <Suspense
              fallback={
                <View
                  style={{
                    minHeight: willRenderVisibleContextBar ? (isMobile ? 52 : 40) : 0,
                    width: '100%',
                  }}
                  aria-hidden
                />
              }
            >
              <HeaderContextBarLazy />
            </Suspense>
          ) : null}
          </View>
      </View>
    );
}

export default React.memo(CustomHeader);
