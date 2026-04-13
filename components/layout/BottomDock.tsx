import React, { memo, useCallback as useCallbackReact, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  SafeAreaView,
  LayoutChangeEvent,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter, type Href } from "expo-router";
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { useThemedColors } from "@/hooks/useTheme";
import { globalFocusStyles } from "@/styles/globalFocus";
import { useResponsive } from "@/hooks/useResponsive";
import { useAndroidBackHandler } from "@/hooks/useAndroidBackHandler";
import { hapticSelection } from "@/utils/haptics";
import {
  BOTTOM_DOCK_ITEM_DEFS,
  BOTTOM_DOCK_MORE_MENU_SECTIONS,
  normalizeBottomDockActivePath,
} from "./bottomDockModel";

let GorhomBottomSheet: any = null;
let GorhomBottomSheetView: any = null;
let GorhomBottomSheetBackdrop: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('@gorhom/bottom-sheet');
    GorhomBottomSheet = mod.default;
    GorhomBottomSheetView = mod.BottomSheetView;
    GorhomBottomSheetBackdrop = mod.BottomSheetBackdrop;
  } catch {
    // Fallback to web/native inline logic when bottom sheet lib is unavailable.
  }
}

type BottomDockProps = {
  onDockHeight?: (h: number) => void;
};

type DockItem = {
  key: string;
  label: string;
  accessibilityLabel: string;
  route: Href;
  icon: React.ReactNode;
  isMore?: boolean;
};

const MOBILE_DOCK_HEIGHT_WEB = 56;

const DockButton = memo(function DockButton({
  label,
  accessibilityLabel,
  href,
  children,
  testID,
  showLabel = true,
  onPress,
  isActive = false,
  styles,
}: {
  label: string;
  accessibilityLabel: string;
  href: Href;
  children: React.ReactNode;
  testID?: string;
  showLabel?: boolean;
  onPress?: () => void;
  isActive?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        if (onPress) {
          onPress();
          return;
        }
        router.push(href as any);
      }}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive }}
      hitSlop={6}
      testID={testID}
      android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: false }}
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
        {isActive ? <View style={styles.itemActiveMarker} /> : null}
      </View>
    </Pressable>
  );
});

function BottomDock({ onDockHeight }: BottomDockProps) {
  const { isPhone, isLargePhone, isTablet } = useResponsive();
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = Platform.OS !== "web" ? true : (isPhone || isLargePhone || isTablet);
  const isCompactMobileWidth = viewportWidth > 0 && viewportWidth <= 390;
  const [showMore, setShowMore] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const nativeSheetRef = useRef<any>(null);
  const nativeSnapPoints = useMemo(() => ['45%'], []);
  const colors = useThemedColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // На iOS учитываем home indicator (safe area bottom)
  // На web используем фиксированную высоту без insets
  const safeBottomPadding = Platform.OS === 'web' ? 0 : Math.max(0, insets.bottom);

  const handleDismissSheet = useCallbackReact(() => {
    if (!showMore) return false;
    setShowMore(false);
    if (Platform.OS !== 'web' && nativeSheetRef.current) {
      nativeSheetRef.current.close();
    }
    return true;
  }, [showMore]);
  useAndroidBackHandler(handleDismissSheet);

  const styles = useMemo(
    () => createStyles(colors, safeBottomPadding, isCompactMobileWidth),
    [colors, safeBottomPadding, isCompactMobileWidth]
  );

  const activePath = useMemo(() => normalizeBottomDockActivePath(pathname), [pathname]);

  useEffect(() => {
    if (!showMore) {
      setSheetVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setSheetVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [showMore]);

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
    if (Platform.OS !== "web" || typeof document === "undefined") return;
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

  const items: DockItem[] = useMemo(
    () =>
      BOTTOM_DOCK_ITEM_DEFS.map((def) => {
        const isActive = activePath === String(def.route);
        const iconColor = isActive ? colors.primary : colors.textMuted;
        return {
          key: def.key,
          label: def.label,
          accessibilityLabel: def.accessibilityLabel,
          route: def.route,
          icon: <Feather name={def.iconName} size={22} color={iconColor} />,
          isMore: def.isMore,
        };
      }),
    [activePath, colors.primary, colors.textMuted]
  );

  const renderMoreMenuItem = useCallbackReact(
    (item: (typeof BOTTOM_DOCK_MORE_MENU_SECTIONS)[number]["items"][number], closeMenu: () => void) => (
      <Pressable
        key={item.key}
        onPress={() => {
          closeMenu();
          router.push(item.route as any);
        }}
        style={[styles.moreItem, globalFocusStyles.focusable]}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        accessibilityRole="link"
        accessibilityLabel={item.accessibilityLabel}
      >
        <Feather
          name={item.iconName}
          size={18}
          color={item.muted ? colors.textMuted : colors.primary}
          style={styles.moreItemIcon}
        />
        <Text style={[styles.moreItemText, item.muted && styles.moreItemTextMuted]}>
          {item.label}
        </Text>
      </Pressable>
    ),
    [colors.primary, colors.textMuted, router, styles.moreItem, styles.moreItemIcon, styles.moreItemText, styles.moreItemTextMuted]
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
        <View style={styles.measure} onLayout={handleDockLayout} testID="footer-dock-measure">
          <View
            style={styles.row}
            testID="footer-dock-row"
            accessibilityRole="tablist"
            accessibilityLabel="Навигация"
          >
            {items.map((item) => {
              const isActive = !item.isMore && activePath === String(item.route);
              return (
                <View key={item.key} style={styles.itemSlot}>
                  <DockButton
                    testID={`footer-item-${item.key}`}
                    href={item.route}
                    label={item.label}
                    accessibilityLabel={item.accessibilityLabel}
                    showLabel
                    onPress={item.isMore ? () => {
                      if (Platform.OS !== 'web' && GorhomBottomSheet && nativeSheetRef.current) {
                        nativeSheetRef.current.expand();
                      }
                      setShowMore(true);
                    } : undefined}
                    isActive={isActive}
                    styles={styles}
                  >
                    {item.icon}
                  </DockButton>
                </View>
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
              onPointerDown: handleSwipeStart,
              onPointerUp: handleSwipeEnd,
              onTouchStart: handleSwipeStart,
              onTouchEnd: handleSwipeEnd,
            } as any)}
          >
            <View style={styles.sheetHandle} accessible={false} importantForAccessibility="no" />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetEyebrow}>Быстрые действия</Text>
                <Text style={styles.sheetTitle}>Ещё</Text>
              </View>
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
              {BOTTOM_DOCK_MORE_MENU_SECTIONS.map((section, sectionIndex) => (
                <React.Fragment key={section.key}>
                  {section.items.map((item) => renderMoreMenuItem(item, () => setShowMore(false)))}
                  {sectionIndex < BOTTOM_DOCK_MORE_MENU_SECTIONS.length - 1 ? <View style={styles.moreDivider} /> : null}
                </React.Fragment>
              ))}
            </View>
          </View>
        </>
      )}
      {Platform.OS !== 'web' && GorhomBottomSheet && (
        <GorhomBottomSheet
          ref={nativeSheetRef}
          index={-1}
          snapPoints={nativeSnapPoints}
          enablePanDownToClose
          onClose={() => setShowMore(false)}
          backdropComponent={(props: any) =>
            GorhomBottomSheetBackdrop ? (
              <GorhomBottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
            ) : null
          }
          handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
          backgroundStyle={{ backgroundColor: colors.surface }}
        >
          {GorhomBottomSheetView && (
            <GorhomBottomSheetView style={{ paddingHorizontal: 16, paddingBottom: safeBottomPadding + 16 }}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.sheetEyebrow}>Быстрые действия</Text>
                  <Text style={styles.sheetTitle}>Ещё</Text>
                </View>
              </View>
              <View style={styles.moreList}>
                {BOTTOM_DOCK_MORE_MENU_SECTIONS.map((section, sectionIndex) => (
                  <React.Fragment key={section.key}>
                    {section.items
                      .filter((item) => Platform.OS === 'web' || item.route !== '/privacy')
                      .filter((item) => Platform.OS === 'web' || item.route !== '/cookies')
                      .map((item) =>
                        renderMoreMenuItem(item, () => {
                          nativeSheetRef.current?.close();
                        })
                      )}
                    {sectionIndex < BOTTOM_DOCK_MORE_MENU_SECTIONS.length - 1 ? <View style={styles.moreDivider} /> : null}
                  </React.Fragment>
                ))}
              </View>
            </GorhomBottomSheetView>
          )}
        </GorhomBottomSheet>
      )}
    </Container>
  );
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  safeBottomPadding: number = 0,
  isCompactMobileWidth: boolean = false
) => StyleSheet.create({
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
    width: "100%",
    paddingTop: 4,
    paddingBottom: Platform.select({ web: 6, default: Math.max(4, safeBottomPadding + 2) }),
    paddingHorizontal: isCompactMobileWidth ? 2 : 4,
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
        maxHeight: 64,
        backdropFilter: "blur(14px)",
        boxShadow: DESIGN_TOKENS.shadows.medium,
      } as any,
    }),
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  measure: {
    width: "100%",
  },
  item: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: isCompactMobileWidth ? 1 : 2,
    paddingVertical: 4,
    minHeight: 44,
    borderRadius: 8,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  itemSlot: {
    flex: 1,
    minWidth: 0,
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    gap: 2,
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: colors.textMuted,
    width: "100%",
    maxWidth: "100%",
    fontSize: isCompactMobileWidth ? 8 : 9,
    lineHeight: isCompactMobileWidth ? 10 : 11,
    marginTop: 1,
    textAlign: "center",
  },
  itemTextActive: {
    color: colors.primaryText,
    fontWeight: "600" as const,
  },
  itemActiveMarker: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  itemTextOnly: {
    marginTop: 0,
  },
  moreBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: colors.overlay,
    zIndex: 10900,
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
    transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
    transform: 'translateY(0)',
  } as any,
  moreSheetHidden: {
    transform: 'translateY(100%)',
  } as any,
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
  sheetHeaderCopy: {
    gap: 2,
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
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
    minHeight: 48,
    borderRadius: 8,
  },
  moreItemIcon: {
    marginRight: 12,
  } as any,
  moreItemText: {
    fontSize: 15,
    color: colors.text,
  },
  moreItemTextMuted: {
    color: colors.textMuted,
  },
  moreDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});

export default memo(BottomDock);
