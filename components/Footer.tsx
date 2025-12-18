import React from "react";
import { View, Platform, useWindowDimensions } from "react-native";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import BottomDock from "@/components/BottomDock";
import FooterDesktop from "@/components/FooterDesktop";

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { width } = useWindowDimensions();
  const effectiveWidth =
    Platform.OS === "web"
      ? width === 0
        ? typeof window !== "undefined"
          ? window.innerWidth
          : 0
        : width
      : width;
  const isMobile = Platform.OS !== "web" ? true : effectiveWidth < DESIGN_TOKENS.breakpoints.mobile;

  if (isMobile) {
    return <BottomDock onDockHeight={onDockHeight} />;
  }

  return (
    <View style={{ paddingVertical: 10 }}>
      <FooterDesktop />
    </View>
  );
};

export default Footer;