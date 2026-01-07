import React, { Suspense, lazy } from "react";
import { View, Platform } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

const BottomDockLazy = isTestEnv
  ? (require('@/components/BottomDock').default as React.ComponentType<any>)
  : lazy(() => import('@/components/BottomDock'));

const FooterDesktopLazy = isTestEnv
  ? (require('@/components/FooterDesktop').default as React.ComponentType<any>)
  : lazy(() => import('@/components/FooterDesktop'));

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);

  if (isMobile) {
    return isTestEnv ? (
      <BottomDockLazy onDockHeight={onDockHeight} />
    ) : (
      <Suspense fallback={null}>
        <BottomDockLazy onDockHeight={onDockHeight} />
      </Suspense>
    );
  }

  return (
    <View style={{ paddingVertical: 0 }}>
      {isTestEnv ? (
        <FooterDesktopLazy />
      ) : (
        <Suspense fallback={null}>
          <FooterDesktopLazy />
        </Suspense>
      )}
    </View>
  );
};

export default Footer;