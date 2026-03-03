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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  // NAV-02: slide-up анимация — отдельный флаг для CSS transition
  const [sheetVisible, setSheetVisible] = useState(false);
  const colors = useThemedColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // На iOS учитываем home indicator (safe area bottom)
  // На web используем фиксированную высоту без insets
  const safeBottomPadding = Platform.OS === 'web' ? 0 : Math.max(0, insets.bottom);

  const styles = useMemo(() => createStyles(colors, safeBottomPadding), [colors, safeBottomPadding]);

  const activePath = useMemo(() => {
    // Normalize: Expo Router may include group prefixes like /(tabs)/
    const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/';
    if (normalized === '/' || normalized === '/index') return '/search';
    if (normalized.startsWith('/travels/')) return '/search';
    if (normalized.startsWith('/travel/')) return '/search';
    if (normalized.startsWith('/search')) return '/search';
    if (normalized.startsWith('/travelsby')) return '/travelsby';
    if (normalized.startsWith('/export')) return '/export';
    if (normalized.startsWith('/map')) return '/map';
    if (normalized.startsWith('/quests')) return '/quests';
    if (normalized.startsWith('/roulette')) return '/search';
    return normalized;
  }, [pathname]);

  // NAV-02: Управление slide-up анимацией для moreSheet
  // При открытии: сначала монтируем (showMore=true), потом через RAF делаем visible
  // При закрытии: сначала убираем visible, ждём transition, потом размонтируем
  useEffect(() => {
    if (!showMore) {
      setSheetVisible(false);
      return;
    }
    // Монтируем → через RAF выставляем visible чтобы CSS transition сработал
    const raf = requestAnimationFrame(() => setSheetVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [showMore]);


  // NAV-13: Swipe-to-close для moreSheet
  const swipeStartY = useRef<number | null>(null);
  const handleSwipeStart = (e: React.PointerEvent | React.TouchEvent) => {
    const y = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientY : (e as React.PointerEvent).clientY;
    if (typeof y === 'number') swipeStartY.current = y;
  };
  const handleSwipeEnd = (e: React.PointerEvent | React.TouchEvent) => {
    if (swipeStartY.current == null) return;
    const y = 'changedTouches' in e ? (e as React.TouchEvent).changedTouches[0]?.clientY : (e as React.PointerEvent).clientY;
    if (typeof y === 'number' && y - swipeStartY.current > 60) {
      setShowMore(false);
    }
    swipeStartY.current = null;
  };

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
      { key: "home", label: "Идеи поездок", route: "/search" as any, iconName: "compass" as const },
      { key: "search", label: "Беларусь", route: "/travelsby" as any, iconName: "map" as const },
      { key: "map", label: "Карта", route: "/map" as any, iconName: "map-pin" as const },
      { key: "favorites", label: "Квесты", route: "/quests" as any, iconName: "flag" as const },
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
                  showLabel
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
            style={[styles.moreBackdrop, !sheetVisible && styles.moreBackdropHidden]}
            onPress={() => setShowMore(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
          />
          <View
            testID="footer-more-sheet"
            style={[styles.moreSheet, !sheetVisible && styles.moreSheetHidden]}
            {...({
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Дополнительное меню',
              // NAV-13: swipe-to-close handlers
              onPointerDown: handleSwipeStart,
              onPointerUp: handleSwipeEnd,
              onTouchStart: handleSwipeStart,
              onTouchEnd: handleSwipeEnd,
            } as any)}
          >
            {/* NAV-02: drag-indicator для bottom sheet */}
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Ещё</Text>
              <Pressable
                onPress={() => setShowMore(false)}
                style={[styles.sheetCloseBtn, globalFocusStyles.focusable]}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Feather name="x" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <View testID="footer-more-list" style={styles.moreList}>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/roulette" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Случайная поездка"
              >
                <Feather name="shuffle" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Случайная поездка</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/travel/new" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Создать маршрут"
              >
                <Feather name="plus-circle" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Создать маршрут</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/export" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Книга путешествий"
              >
                <Feather name="book-open" size={18} color={colors.primary} style={styles.moreItemIcon} />
                <Text style={styles.moreItemText}>Книга путешествий</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/profile" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Профиль"
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
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Политика конфиденциальности"
              >
                <Feather name="shield" size={18} color={colors.textMuted} style={styles.moreItemIcon} />
                <Text style={[styles.moreItemText, { color: colors.textMuted }]}>Политика конфиденциальности</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/cookies" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Настройки cookies"
              >
                <Feather name="settings" size={18} color={colors.textMuted} style={styles.moreItemIcon} />
                <Text style={[styles.moreItemText, { color: colors.textMuted }]}>Настройки cookies</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMore(false);
                  router.push("/about" as any);
                }}
                style={[styles.moreItem, globalFocusStyles.focusable]}
                accessibilityRole="link"
                accessibilityLabel="Связаться с нами"
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

const createStyles = (colors: ReturnType<typeof useThemedColors>, safeBottomPadding: number = 0) => StyleSheet.create({
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
    paddingBottom: Platform.select({ web: 8, default: Math.max(6, safeBottomPadding + 4) }),
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
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    textAlign: "center",
  },
  itemTextActive: {
    color: colors.primaryText,
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
    // NAV-02: fade-in backdrop
    transition: 'opacity 0.28s ease',
  } as any,
  moreBackdropHidden: {
    opacity: 0,
    pointerEvents: 'none',
  } as any,
  moreSheet: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    zIndex: 11000,
    boxShadow: DESIGN_TOKENS.shadows.modal,
    // NAV-02: slide-up анимация
    transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
    transform: 'translateY(0)',
  } as any,
  moreSheetHidden: {
    transform: 'translateY(100%)',
  } as any,
  // NAV-02: drag indicator + заголовок sheet
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  } as any,
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  moreList: {
    gap: 4,
  } as any,
  moreItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 8,
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
