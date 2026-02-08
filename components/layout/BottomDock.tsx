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
import { usePathname, useRouter, type Href } from "expo-router";
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

function BottomDock({ onDockHeight }: BottomDockProps) {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);
  const [showMore, setShowMore] = useState(false);
  const colors = useThemedColors();
  const router = useRouter();
  const pathname = usePathname();

  const activePath = useMemo(() => {
    if (pathname === '/' || pathname === '/index') return '/';
    if (pathname.startsWith('/travels/')) return '/';
    return pathname;
  }, [pathname]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const DockButton = memo(function DockButton({
    label,
    href,
    children,
    testID,
    showLabel = true,
    onPress,
    isActive = false,
  }: {
    label: string;
    href: Href;
    children: React.ReactNode;
    testID?: string;
    showLabel?: boolean;
    onPress?: () => void;
    isActive?: boolean;
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
        accessibilityState={{ selected: isActive }}
        hitSlop={6}
        testID={testID}
        style={({ pressed }) => [
          styles.item,
          isActive && styles.itemActive,
          pressed && styles.pressed,
          globalFocusStyles.focusable,
        ]}
      >
        <View style={styles.itemInner}>
          <View style={styles.iconBox}>{children}</View>
          {showLabel ? (
            <Text
              style={[styles.itemText, isActive && styles.itemTextActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;
    if (showMore) {
      body.setAttribute("data-footer-more-open", "true");
    } else {
      body.removeAttribute("data-footer-more-open");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("metravel:footer-more", { detail: { open: showMore } }));
    }
  }, [showMore]);

  const dockItemDefs = useMemo(
    () => [
      { key: "home", label: "Главная", route: "/" as any, iconName: "home" as const },
      { key: "search", label: "Поиск", route: "/search" as any, iconName: "search" as const },
      { key: "map", label: "Карта", route: "/map" as any, iconName: "map-pin" as const },
      { key: "favorites", label: "Избранное", route: "/favorites" as any, iconName: "heart" as const },
      { key: "more", label: "Ещё", route: "/more" as any, iconName: "more-horizontal" as const, isMore: true },
    ],
    []
  );

  const items: DockItem[] = useMemo(
    () =>
      dockItemDefs.map((def) => {
        const isActive = !def.isMore && activePath === String(def.route);
        const iconColor = isActive ? colors.primary : colors.textMuted;
        return {
          key: def.key,
          label: def.label,
          route: def.route,
          icon: <Feather name={def.iconName} size={22} color={iconColor} />,
          isMore: def.isMore,
        };
      }),
    [dockItemDefs, activePath, colors.primary, colors.textMuted]
  );

  if (!isMobile) return null;

  const Container = Platform.OS === "ios" || Platform.OS === "android" ? SafeAreaView : View;

  return (
    <Container style={[styles.container, showMore && styles.containerOpen]}>
      <View
        style={[
          styles.dockWrapper,
          Platform.OS === "web" ? ({ height: MOBILE_DOCK_HEIGHT_WEB } as any) : null,
        ]}
        testID="footer-dock-wrapper"
      >
        <View onLayout={handleDockLayout} testID="footer-dock-measure">
          <View style={styles.row} testID="footer-dock-row">
            {items.map((item) => {
              const isActive = !item.isMore && activePath === String(item.route);
              return (
                <DockButton
                  key={item.key}
                  testID={`footer-item-${item.key}`}
                  href={item.route}
                  label={item.label}
                  showLabel={Platform.OS === "web"}
                  onPress={item.isMore ? () => setShowMore(true) : undefined}
                  isActive={isActive}
                >
                  {item.icon}
                </DockButton>
              );
            })}
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
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/travelsby" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="flag" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Беларусь</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/travel/new" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="plus-circle" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Создать маршрут</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/profile" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="user" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Профиль</Text>
              </Pressable>
              <View style={styles.moreDivider} />
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/privacy" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="shield" size={18} color={colors.textMuted} style={styles.moreItemIcon} />
                <Text style={[styles.moreItemText, { color: colors.textMuted }]}>Политика конфиденциальности</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/cookies" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="settings" size={18} color={colors.textMuted} style={styles.moreItemIcon} />
                <Text style={[styles.moreItemText, { color: colors.textMuted }]}>Настройки cookies</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/about" as any);
                }}
                style={styles.moreItem}
              >
                <Feather name="mail" size={18} color={colors.textMuted} style={styles.moreItemIcon} />
                <Text style={[styles.moreItemText, { color: colors.textMuted }]}>Связаться с нами</Text>
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
  containerOpen: {
    zIndex: 11000,
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
  itemActive: {
    backgroundColor: colors.primarySoft,
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
    lineHeight: 12,
    marginTop: 2,
    textAlign: "center",
  },
  itemTextActive: {
    color: colors.primary,
    fontWeight: "600" as const,
  },
  itemTextOnly: {
    marginTop: 0,
  },
  moreBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: colors.overlay,
    zIndex: 10900,
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
    zIndex: 11000,
    boxShadow: DESIGN_TOKENS.shadows.modal,
  } as any,
  moreList: {
    gap: 4,
  } as any,
  moreItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreItemIcon: {
    marginRight: 12,
  } as any,
  moreItemText: {
    fontSize: 15,
    color: colors.text,
  },
  moreDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});

export default memo(BottomDock);
