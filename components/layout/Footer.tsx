import React from "react";
import { View, Platform } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import BottomDock from '@/components/layout/BottomDock';
import FooterDesktop from '@/components/layout/FooterDesktop';

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);

  if (isMobile) {
    return <BottomDock onDockHeight={onDockHeight} />;
  }

  return (
    <View style={{ paddingVertical: 0 }}>
      <FooterDesktop />
    </View>
  );
};

export default React.memo(Footer);
