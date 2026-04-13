import React, { Suspense, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';

import { useThemedColors } from '@/hooks/useTheme';

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
import { createCustomHeaderStyles, webStickyStyle } from './customHeaderStyles';
import Logo from './Logo';

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
            <Suspense fallback={null}>
              <HeaderContextBarLazy />
            </Suspense>
          ) : null}
          </View>
      </View>
    );
}

export default React.memo(CustomHeader);
