import React, { useRef, useEffect, useMemo, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  Modal,
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { globalFocusStyles } from "@/styles/globalFocus"; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

/** ========= Prop для передачи высоты дока ========= */
type FooterProps = {
  /** Высота горизонтального «дока» с иконками на мобайле. На десктопе = 0. */
  onDockHeight?: (h: number) => void;
};

/** ========= Types ========= */
type NavItem = {
  key: string;
  label: string;
  route?: Href;
  externalUrl?: string;
  icon: React.ReactNode;
};

/** ========= Helpers ========= */
const openURL = (url: string) => Linking.openURL(url).catch(() => {});

const Item = memo(function Item({
  children,
  onPress,
  href,
  label,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  href?: Href;
  label: string;
  testID?: string;
}) {
  const router = useRouter();

  const content = (
    <View style={styles.itemInner}>
      <View style={styles.iconBox}>{children}</View>
      <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );

  if (href) {
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
          globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [
        styles.item, 
        pressed && styles.pressed,
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
      ]}
    >
      {content}
    </Pressable>
  );
});

/** ========= Component ========= */
const palette = DESIGN_TOKENS.colors;

const MOBILE_DOCK_HEIGHT_WEB = 80;

const SUPPORT_EMAIL = 'metraveldev@gmail.com';

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const [isClientReady, setIsClientReady] = React.useState(
    Platform.OS !== 'web' || typeof window !== 'undefined'
  );
  const { width } = useWindowDimensions();
  const [webMobileMQ, setWebMobileMQ] = React.useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(`(max-width: ${DESIGN_TOKENS.breakpoints.mobile - 1}px)`).matches;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isClientReady) return;
    setIsClientReady(true);
  }, [isClientReady]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(`(max-width: ${DESIGN_TOKENS.breakpoints.mobile - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setWebMobileMQ(e.matches);

    setWebMobileMQ(mql.matches);

    if ('addEventListener' in mql) {
      // @ts-ignore
      mql.addEventListener('change', handler);
      return () => {
        // @ts-ignore
        mql.removeEventListener('change', handler);
      };
    }

    // @ts-ignore
    mql.addListener(handler);
    return () => {
      // @ts-ignore
      mql.removeListener(handler);
    };
  }, []);

  if (!isClientReady && Platform.OS === 'web') {
    return <View style={[styles.base, { height: 96 }]} testID="footer-ssr-placeholder" />;
  }

  const effectiveWidth =
    Platform.OS === 'web'
      ? width === 0
        ? typeof window !== 'undefined'
          ? window.innerWidth
          : DESIGN_TOKENS.breakpoints.mobile
        : width
      : width;
  const isMobile = Platform.OS !== 'web'
    ? true
    : (webMobileMQ || effectiveWidth < DESIGN_TOKENS.breakpoints.mobile);
  const iconColor = palette.primary;

  const [isMoreOpen, setIsMoreOpen] = React.useState(false);

  const lastFocusedElRef = useRef<HTMLElement | null>(null);
  const moreSheetRef = useRef<any>(null);
  const moreCloseBtnRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isMoreOpen) return;

    try {
      lastFocusedElRef.current = (document.activeElement as HTMLElement) || null;
    } catch {
      lastFocusedElRef.current = null;
    }

    const id = window.setTimeout(() => {
      try {
        const closeBtn = moreCloseBtnRef.current as HTMLElement | null;
        const sheet = moreSheetRef.current as HTMLElement | null;
        (closeBtn || sheet)?.focus?.();
      } catch {
        // ignore
      }
    }, 0);

    return () => {
      window.clearTimeout(id);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isMoreOpen) return;

    const el = lastFocusedElRef.current;
    if (!el) return;

    const id = window.setTimeout(() => {
      try {
        el.focus?.();
      } catch {
        // ignore
      }
      lastFocusedElRef.current = null;
    }, 0);

    return () => {
      window.clearTimeout(id);
    };
  }, [isMoreOpen]);

  const headerNav: NavItem[] = useMemo(
    () => [
      { key: "home",     label: "Путешествия", route: "/",          icon: <Feather name="home"   size={20} color={iconColor} /> },
      { key: "by",       label: "Беларусь",    route: "/travelsby", icon: <Feather name="globe"  size={20} color={iconColor} /> },
      { key: "map",      label: "Карта",       route: "/map",       icon: <Feather name="map"    size={20} color={iconColor} /> },
      { key: "roulette", label: "Случайный маршрут", route: "/roulette",  icon: <Feather name="shuffle" size={20} color={iconColor} /> },
      { key: "quests",   label: "Квесты",      route: "/quests",    icon: <Feather name="flag"   size={20} color={iconColor} /> },
    ],
    [iconColor]
  );

  const extra: NavItem[] = useMemo(
    () => [
      { key: "about",  label: "О сайте",     route: "/about",     icon: <Feather name="info"  size={20} color={iconColor} /> },
      { key: "privacy", label: "Политика конфиденциальности", route: "/privacy", icon: <Feather name="shield" size={20} color={iconColor} /> },
      { key: "cookies", label: "Настройки cookies", route: "/cookies", icon: <Feather name="sliders" size={20} color={iconColor} /> },
      { key: "blogby", label: "Пишут о BY",  route: "/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi", icon: <Feather name="list" size={20} color={iconColor} /> },
    ],
    [iconColor]
  );

  const support: NavItem[] = useMemo(
    () => [
      {
        key: 'support-email',
        label: 'Связаться с нами',
        externalUrl: `mailto:${SUPPORT_EMAIL}`,
        icon: <Feather name="mail" size={20} color={iconColor} />,
      },
    ],
    [iconColor]
  );

  const social: NavItem[] = useMemo(
    () => [
      { key: "tt", label: "TikTok",    externalUrl: "https://www.tiktok.com/@metravel.by",   icon: <FontAwesome5 name="tiktok"    size={18} color={iconColor} /> },
      { key: "ig", label: "Instagram", externalUrl: "https://www.instagram.com/metravelby/", icon: <FontAwesome5 name="instagram" size={18} color={iconColor} /> },
      { key: "yt", label: "YouTube",   externalUrl: "https://www.youtube.com/@metravelby",   icon: <FontAwesome5 name="youtube"   size={18} color={iconColor} /> },
    ],
    [iconColor]
  );

  const allItems = useMemo(() => [...headerNav, ...extra, ...social], [headerNav, extra, social]);
  const webMobileAllItemsWithoutLegal = useMemo(
    () => [...headerNav, ...extra.filter((x) => x.key !== 'privacy' && x.key !== 'cookies'), ...social],
    [headerNav, extra, social]
  );
  const webMobileFallbackItems = useMemo(() => [...extra, ...social], [extra, social]);
  const webMobileModalItems = useMemo(
    () => {
      const about = extra.find((x) => x.key === 'about');
      const blogby = extra.find((x) => x.key === 'blogby');
      const privacy = extra.find((x) => x.key === 'privacy');
      const cookies = extra.find((x) => x.key === 'cookies');
      return [about, blogby, privacy, cookies, ...support].filter(Boolean) as NavItem[];
    },
    [extra, support]
  );

  const Container = (Platform.OS === "ios" || Platform.OS === "android") ? SafeAreaView : View;

  /** ======= измеряем только ДОК (иконки) ======= */
  const lastDockH = useRef(0);
  const handleDockLayout = (e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') return;
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== lastDockH.current) {
      lastDockH.current = h;
      onDockHeight?.(h);
    }
  };

  useEffect(() => {
      if (!isMobile && onDockHeight) {
          onDockHeight(0);
      }
  }, [isMobile, onDockHeight]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isMobile) return;
    onDockHeight?.(MOBILE_DOCK_HEIGHT_WEB);
  }, [isMobile, onDockHeight]);

  const itemsToRender = useMemo(() => {
    if (!isMobile) return [];

    if (Platform.OS !== 'web') {
      // Native: one scrollable row, show everything.
      return allItems;
    }

    // Web: one row, no scroll. Show everything only if it fits.
    const estimateItemWidth = 60;
    const estimateGap = 2;
    const moreItem: NavItem = {
      key: 'more',
      label: 'Ещё',
      icon: <Feather name="more-horizontal" size={20} color={iconColor} />,
    };

    const canFit = (items: NavItem[]) => {
      const estimatedMinWidth =
        items.length * estimateItemWidth + Math.max(0, items.length - 1) * estimateGap;
      return effectiveWidth >= estimatedMinWidth + 24;
    };

    const primary = [...webMobileAllItemsWithoutLegal, moreItem];
    if (canFit(primary)) return primary;

    const fallback = [...webMobileFallbackItems.filter((x) => x.key !== 'privacy' && x.key !== 'cookies'), moreItem];
    if (canFit(fallback)) return fallback;

    const minimal = [...social, moreItem];
    if (canFit(minimal)) return minimal;

    return [moreItem];
  }, [allItems, effectiveWidth, isMobile, webMobileAllItemsWithoutLegal, webMobileFallbackItems]);

  /** ======= Mobile: суперкомпактный «док» ======= */
  if (isMobile) {
    return (
      <Container style={[styles.base, mobileStyles.container]}>
        <View
          style={[
            mobileStyles.dockWrapper,
            Platform.OS === 'web' ? ({ height: MOBILE_DOCK_HEIGHT_WEB } as any) : null,
          ]}
          testID="footer-dock-wrapper"
        >
          {/* измеряем ровно эту область */}
          <View
            onLayout={handleDockLayout}
            testID="footer-dock-measure"
            style={
              Platform.OS === 'web'
                ? ({ maxHeight: 96, overflow: 'hidden' } as any)
                : undefined
            }
          >
            {Platform.OS === 'web' ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[mobileStyles.dockBase, mobileStyles.dockNoWrapWeb]}
                  testID="footer-dock-row"
                >
                  {itemsToRender.map((item) =>
                    item.key === 'more' ? (
                      <Item
                        key={item.key}
                        testID={`footer-item-${item.key}`}
                        onPress={() => {
                          if (Platform.OS === 'web' && typeof document !== 'undefined') {
                            try {
                              lastFocusedElRef.current = document.activeElement as HTMLElement;
                            } catch {
                              lastFocusedElRef.current = null;
                            }
                          }
                          setIsMoreOpen(true);
                        }}
                        label={item.label}
                      >
                        {item.icon}
                      </Item>
                    ) : item.externalUrl ? (
                      <Item key={item.key} testID={`footer-item-${item.key}`} onPress={() => openURL(item.externalUrl!)} label={item.label}>
                        {item.icon}
                      </Item>
                    ) : (
                      <Item key={item.key} testID={`footer-item-${item.key}`} href={item.route} label={item.label}>
                        {item.icon}
                      </Item>
                    )
                  )}
                </ScrollView>

                <Modal
                  visible={isMoreOpen}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setIsMoreOpen(false)}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Закрыть"
                    onPress={() => setIsMoreOpen(false)}
                    style={modalStyles.backdrop}
                    testID="footer-more-backdrop"
                  >
                    <Pressable
                      ref={moreSheetRef}
                      style={modalStyles.sheet}
                      onPress={() => {}}
                      testID="footer-more-sheet"
                      {...(Platform.OS === 'web'
                        ? ({ tabIndex: -1, role: 'dialog', 'aria-modal': 'true' } as any)
                        : {})}
                    >
                      <View style={modalStyles.headerRow}>
                        <Text style={modalStyles.title}>Ещё</Text>
                        <Pressable
                          ref={moreCloseBtnRef}
                          accessibilityRole="button"
                          accessibilityLabel="Закрыть"
                          onPress={() => setIsMoreOpen(false)}
                          hitSlop={8}
                          style={({ pressed }) => [modalStyles.closeBtn, pressed && styles.pressed]}
                          {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {})}
                        >
                          <Feather name="x" size={18} color={palette.textMuted} />
                        </Pressable>
                      </View>

                      <View style={modalStyles.list} testID="footer-more-list">
                        {webMobileModalItems.map((item) =>
                          item.externalUrl ? (
                            <Item
                              key={item.key}
                              testID={`footer-item-modal-${item.key}`}
                              onPress={() => {
                                setIsMoreOpen(false);
                                openURL(item.externalUrl!);
                              }}
                              label={item.label}
                            >
                              {item.icon}
                            </Item>
                          ) : (
                            <Item
                              key={item.key}
                              testID={`footer-item-modal-${item.key}`}
                              href={item.route}
                              label={item.label}
                            >
                              {item.icon}
                            </Item>
                          )
                        )}
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              </>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[mobileStyles.dockBase, mobileStyles.dockScroll]}
              >
                {itemsToRender.map((item) =>
                  item.externalUrl ? (
                    <Item key={item.key} testID={`footer-item-${item.key}`} onPress={() => openURL(item.externalUrl!)} label={item.label}>
                      {item.icon}
                    </Item>
                  ) : (
                    <Item key={item.key} testID={`footer-item-${item.key}`} href={item.route} label={item.label}>
                      {item.icon}
                    </Item>
                  )
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Container>
    );
  }

  /** ======= Desktop: иконка + подпись ======= */

  return (
    <Container style={[styles.base, desktopStyles.container]}>
      <View style={desktopStyles.bar} testID="footer-desktop-bar">
        <View style={desktopStyles.group}>
          {extra.map((item) => (
            <Item key={item.key} testID={`footer-item-${item.key}`} href={item.route} label={item.label}>
              {item.icon}
            </Item>
          ))}
        </View>

        <View style={desktopStyles.group}>
          {social.map((s) => (
            <Item key={s.key} testID={`footer-item-${s.key}`} onPress={() => openURL(s.externalUrl!)} label={s.label}>
              {s.icon}
            </Item>
          ))}
          <Text style={styles.copy}>© MeTravel 2020–{new Date().getFullYear()}</Text>
        </View>
      </View>
    </Container>
  );
};

/** ========= Common styles ========= */
const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    marginTop: -1, // Устраняем зазор между контентом и футером
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    minHeight: 44,
    borderRadius: 8, // ✅ ИСПРАВЛЕНИЕ: Добавлен borderRadius для hover
    // ✅ ИСПРАВЛЕНИЕ: Добавлены hover-состояния для веб
    ...Platform.select({
      web: {
        display: 'flex',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
          transform: 'scale(1.05)',
        },
        ':active': {
          transform: 'scale(1)',
        },
      } as any,
    }),
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,               // Уменьшили расстояние между иконкой и текстом
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 12,
    marginTop: 2,         // Уменьшили отступ сверху
    textAlign: "center",
  },
  logo: { width: 18, height: 18, marginRight: 8 },
  copy: { color: palette.textSubtle, fontSize: 13, lineHeight: 16, marginLeft: 12 },
  copyCompact: { marginLeft: 0, marginTop: 6, textAlign: 'center' },
});

/** ========= Mobile ========= */
const mobileStyles = StyleSheet.create({
  container: {
    // @ts-ignore
    position: Platform.OS === "web" ? "fixed" : "relative",
    bottom: 0,
    ...(Platform.OS === 'web'
      ? ({ left: 0, right: 0, width: '100%' } as any)
      : null),
    zIndex: 50,
    marginTop: -1, // Дополнительное перекрытие для мобильных устройств
  },
  dockWrapper: {
    paddingTop: 4,        // Уменьшили отступы
    paddingBottom: Platform.select({ web: 6, default: 4 }), // Увеличили паддинг внизу для web
    paddingHorizontal: 8, // Уменьшили отступы
    backgroundColor: palette.dockBackground,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    ...Platform.select({
      web: {
        maxHeight: 96,
        // @ts-ignore
        backdropFilter: "blur(14px)",
      },
    }),
  },
  dockBase: {
    flexDirection: 'row',
    alignItems: "center",
    gap: 2,               // Уменьшили расстояние между иконками
  },
  dockScroll: {
    flexWrap: 'nowrap',
  },
  dockNoWrapWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
    // @ts-ignore - web-only
    width: '100%',
  },
  dockTwoRowsWeb: {
    // @ts-ignore - web-only
    width: '100%',
    gap: 2 as any,
  },
  dockRowWeb: {
    flexWrap: 'nowrap',
    justifyContent: 'center',
    // @ts-ignore - web-only
    width: '100%',
  },
  // Убрали brandRow полностью
});

/** ========= Desktop ========= */
const desktopStyles = StyleSheet.create({
  container: { paddingVertical: 10 },
  bar: {
    maxWidth: 1280,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 24,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    ...Platform.select({
      web: {
        flexWrap: 'nowrap',
        overflowX: 'hidden',
        overflowY: 'visible',
      } as any,
    }),
  },
  barCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 10,
    gap: 8 as any,
  },
  group: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 20 as any,
    ...Platform.select({
      web: {
        flexWrap: 'nowrap',
        flexShrink: 1,
      } as any,
    }),
  },
  groupCompact: {
    justifyContent: 'center',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8 as any,
    paddingTop: 4,
  },
});

export default Footer;