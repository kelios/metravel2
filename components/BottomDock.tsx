import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
  SafeAreaView,
  LayoutChangeEvent,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { globalFocusStyles } from "@/styles/globalFocus";

type BottomDockProps = {
  onDockHeight?: (h: number) => void;
};

type DockItem = {
  key: string;
  label: string;
  route: Href;
  icon: React.ReactNode;
};

const palette = DESIGN_TOKENS.colors;
const MOBILE_DOCK_HEIGHT_WEB = 64;

const DockButton = memo(function DockButton({
  label,
  href,
  children,
  testID,
}: {
  label: string;
  href: Href;
  children: React.ReactNode;
  testID?: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href as any)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [
        styles.item,
        pressed && styles.pressed,
        globalFocusStyles.focusable,
      ]}
    >
      <View style={styles.itemInner}>
        <View style={styles.iconBox}>{children}</View>
        <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

export default function BottomDock({ onDockHeight }: BottomDockProps) {
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

  const lastDockH = useRef(0);
  const handleDockLayout = (e: LayoutChangeEvent) => {
    if (Platform.OS === "web") return;
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== lastDockH.current) {
      lastDockH.current = h;
      onDockHeight?.(h);
    }
  };

  useEffect(() => {
    if (!isMobile && onDockHeight) onDockHeight(0);
  }, [isMobile, onDockHeight]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!isMobile) return;
    onDockHeight?.(MOBILE_DOCK_HEIGHT_WEB);
  }, [isMobile, onDockHeight]);

  const iconColor = palette.primary;

  const items: DockItem[] = useMemo(
    () => [
      {
        key: "home",
        label: "Главная",
        route: "/" as any,
        icon: <Feather name="home" size={18} color={iconColor} />,
      },
      {
        key: "search",
        label: "Поиск",
        route: "/search" as any,
        icon: <Feather name="search" size={18} color={iconColor} />,
      },
      {
        key: "map",
        label: "Карта",
        route: "/map" as any,
        icon: <Feather name="map-pin" size={18} color={iconColor} />,
      },
      {
        key: "favorites",
        label: "Избранное",
        route: "/favorites" as any,
        icon: <Feather name="heart" size={18} color={iconColor} />,
      },
      {
        key: "create",
        label: "Создать",
        route: "/travel/new" as any,
        icon: <Feather name="plus" size={18} color={iconColor} />,
      },
      {
        key: "profile",
        label: "Профиль",
        route: "/profile" as any,
        icon: <Feather name="user" size={18} color={iconColor} />,
      },
    ],
    [iconColor]
  );

  if (!isMobile) return null;

  const Container = Platform.OS === "ios" || Platform.OS === "android" ? SafeAreaView : View;

  return (
    <Container style={styles.container}>
      <View
        style={[
          styles.dockWrapper,
          Platform.OS === "web" ? ({ height: MOBILE_DOCK_HEIGHT_WEB } as any) : null,
        ]}
        testID="footer-dock-wrapper"
      >
        <View onLayout={handleDockLayout} testID="footer-dock-measure">
          <View style={styles.row} testID="footer-dock-row">
            {items.map((item) => (
              <DockButton key={item.key} testID={`footer-item-${item.key}`} href={item.route} label={item.label}>
                {item.icon}
              </DockButton>
            ))}
          </View>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    position: Platform.OS === "web" ? ("fixed" as any) : "relative",
    bottom: 0,
    ...(Platform.OS === "web" ? ({ left: 0, right: 0, width: "100%" } as any) : null),
    zIndex: 50,
  },
  dockWrapper: {
    paddingTop: 2,
    paddingBottom: Platform.select({ web: 4, default: 2 }),
    paddingHorizontal: 6,
    backgroundColor: palette.dockBackground,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    ...Platform.select({
      web: {
        maxHeight: 72,
        backdropFilter: "blur(14px)",
      } as any,
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 44,
    borderRadius: 10,
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconBox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: palette.textMuted,
    fontSize: 10,
    lineHeight: 11,
    marginTop: 1,
    textAlign: "center",
  },
});
