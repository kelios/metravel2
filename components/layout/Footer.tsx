import React, { Suspense, lazy } from "react";
import { View, Platform } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import FooterDesktop from '@/components/layout/FooterDesktop';

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

const isFooterTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

const BottomDockComp = isFooterTestEnv
  ? (require('@/components/layout/BottomDock').default as React.ComponentType<FooterProps>)
  : lazy(() => import('@/components/layout/BottomDock'));

const WEB_MOBILE_DOCK_RESERVE_HEIGHT = 56;

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);

  if (isMobile) {
    return (
      <Suspense
        fallback={
          Platform.OS === 'web' ? <View style={{ height: WEB_MOBILE_DOCK_RESERVE_HEIGHT }} /> : null
        }
      >
        <BottomDockComp onDockHeight={onDockHeight} />
      </Suspense>
    );
  }

  return (
    <View style={{ paddingVertical: 0 }}>
      <FooterDesktop />
    </View>
  );
};

export default React.memo(Footer);
