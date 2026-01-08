import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  SafeAreaView,
  LayoutChangeEvent,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { useThemedColors } from "@/hooks/useTheme";
import { globalFocusStyles } from "@/styles/globalFocus";
import { useResponsive } from "@/hooks/useResponsive";

type BottomDockProps = {
  onDockHeight?: (h: number) => void;
};

type DockItem = {
  key: string;
  label: string;
  route: Href;
  icon: React.ReactNode;
  isMore?: boolean;
};

const MOBILE_DOCK_HEIGHT_WEB = 56;

export default function BottomDock({ onDockHeight }: BottomDockProps) {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);
  const [showMore, setShowMore] = useState(false);
  const colors = useThemedColors();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const DockButton = memo(function DockButton({
    label,
    href,
    children,
    testID,
    showLabel = true,
    onPress,
  }: {
    label: string;
    href: Href;
    children: React.ReactNode;
    testID?: string;
    showLabel?: boolean;
    onPress?: () => void;
  }) {
    const router = useRouter();

    return (
      <Pressable
        onPress={() => {
          if (onPress) {
            onPress();
            return;
          }
          router.push(href as any);
        }}
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
          {showLabel ? (
            <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
              {label}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  });


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

  const iconColor = colors.primary;

  const items: DockItem[] = useMemo(
    () => [
      {
        key: "home",
        label: "Главная",
        route: "/" as any,
        icon: <Feather name="home" size={22} color={iconColor} />,
      },
      {
        key: "belarus",
        label: "Беларусь",
        route: "/travelsby" as any,
        icon: <Feather name="flag" size={22} color={iconColor} />,
      },
      {
        key: "map",
        label: "Карта",
        route: "/map" as any,
        icon: <Feather name="map-pin" size={22} color={iconColor} />,
      },
      {
        key: "favorites",
        label: "Избранное",
        route: "/favorites" as any,
        icon: <Feather name="heart" size={22} color={iconColor} />,
      },
      {
        key: "create",
        label: "Создать",
        route: "/travel/new" as any,
        icon: <Feather name="plus-circle" size={22} color={iconColor} />,
      },
      {
        key: "more",
        label: "Ещё",
        route: "/more" as any,
        icon: <Feather name="more-horizontal" size={22} color={iconColor} />,
        isMore: true,
      },
      {
        key: "profile",
        label: "Профиль",
        route: "/profile" as any,
        icon: <Feather name="user" size={22} color={iconColor} />,
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
              <DockButton
                key={item.key}
                testID={`footer-item-${item.key}`}
                href={item.route}
                label={item.label}
                showLabel={false}
                onPress={item.isMore ? () => setShowMore(true) : undefined}
              >
                {item.icon}
              </DockButton>
            ))}
          </View>
        </View>
      </View>
      {showMore && Platform.OS === "web" && (
        <>
          <Pressable
            testID="footer-more-backdrop"
            style={styles.moreBackdrop}
            onPress={() => setShowMore(false)}
          />
          <View testID="footer-more-sheet" style={styles.moreSheet}>
            <View testID="footer-more-list" style={styles.moreList}>
              <Pressable onPress={() => setShowMore(false)} style={styles.moreItem}>
                <Text style={styles.moreItemText}>Политика конфиденциальности</Text>
              </Pressable>
              <Pressable onPress={() => setShowMore(false)} style={styles.moreItem}>
                <Text style={styles.moreItemText}>Настройки cookies</Text>
              </Pressable>
              <Pressable onPress={() => setShowMore(false)} style={styles.moreItem}>
                <Text style={styles.moreItemText}>Связаться с нами</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </Container>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    position: Platform.OS === "web" ? ("fixed" as any) : "relative",
    bottom: 0,
    ...(Platform.OS === "web" ? ({ left: 0, right: 0, width: "100%" } as any) : null),
    zIndex: 50,
  },
  dockWrapper: {
    paddingTop: 6,
    paddingBottom: Platform.select({ web: 8, default: 6 }),
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    ...Platform.select({
      web: {
        maxHeight: 72,
        backdropFilter: "blur(14px)",
        boxShadow: DESIGN_TOKENS.shadows.medium,
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
    paddingVertical: 6,
    minHeight: 44,
    borderRadius: 10,
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 10,
    marginTop: 0,
    textAlign: "center",
  },
  itemTextOnly: {
    marginTop: 0,
  },
  moreBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: colors.overlay,
    zIndex: 999,
  },
  moreSheet: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    zIndex: 1000,
    boxShadow: DESIGN_TOKENS.shadows.modal,
  } as any,
  moreList: {
    gap: 12,
  } as any,
  moreItem: {
    paddingVertical: 8,
  },
  moreItemText: {
    fontSize: 14,
    color: colors.text,
  },
});
