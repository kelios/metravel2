import React, { Suspense, lazy } from "react";
import { View, Platform } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

// ✅ ОПТИМИЗАЦИЯ: Убираем синхронные require для уменьшения entry bundle
const BottomDockLazy = lazy(() => import('@/components/BottomDock'));
const FooterDesktopLazy = lazy(() => import('@/components/FooterDesktop'));

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (isMobile) {
    if (isTestEnv) {
      const BottomDock = require('@/components/BottomDock').default;
      return <BottomDock onDockHeight={onDockHeight} />;
    }
    return (
      <Suspense fallback={null}>
        <BottomDockLazy onDockHeight={onDockHeight} />
      </Suspense>
    );
  }

  if (isTestEnv) {
    const FooterDesktop = require('@/components/FooterDesktop').default;
    return (
      <View style={{ paddingVertical: 0 }}>
        <FooterDesktop />
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 0 }}>
      <Suspense fallback={null}>
        <FooterDesktopLazy />
      </Suspense>
    </View>
  );
};

export default Footer;