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
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import { Link, type Href } from "expo-router";
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
}: {
  children: React.ReactNode;
  onPress?: () => void;
  href?: Href;
  label: string;
}) {
  const content = (
    <View style={styles.itemInner}>
      {children}
      <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );

  if (href) {
    return (
      <Link 
        href={href} 
        accessibilityRole="link" 
        accessibilityLabel={label} 
        style={[styles.item, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
      >
        {content}
      </Link>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
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

const MOBILE_DOCK_MIN_HEIGHT_WEB = 76;

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { width } = useWindowDimensions();
  const effectiveWidth =
    Platform.OS === 'web' && width === 0 && typeof window !== 'undefined'
      ? window.innerWidth
      : width;
  const isMobile = Platform.OS !== 'web' ? true : effectiveWidth <= 900;
  const isCompactDesktop = Platform.OS === 'web' && !isMobile && effectiveWidth < 1200;
  const iconColor = palette.primary;

  const primary: NavItem[] = useMemo(
    () => [
      { key: "home",     label: "Путешествия", route: "/",          icon: <Feather name="home"   size={20} color={iconColor} /> },
      { key: "by",       label: "Беларусь",    route: "/travelsby", icon: <Feather name="globe"  size={20} color={iconColor} /> },
      { key: "map",      label: "Карта",       route: "/map",       icon: <Feather name="map"    size={20} color={iconColor} /> },
      { key: "roulette", label: "Случайный маршрут", route: "/roulette",  icon: <Feather name="shuffle" size={20} color={iconColor} /> },
      { key: "quests",   label: "Квесты",      route: "/quests",    icon: <Feather name="flag"   size={20} color={iconColor} /> },
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

  const allItems = useMemo(() => [...primary, ...social], [primary, social]);
  const webMobileItems = useMemo(() => primary, [primary]);

  const Container = (Platform.OS === "ios" || Platform.OS === "android") ? SafeAreaView : View;

  /** ======= измеряем только ДОК (иконки) ======= */
  const lastDockH = useRef(0);
  const handleDockLayout = (e: LayoutChangeEvent) => {
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

  /** ======= Mobile: суперкомпактный «док» ======= */
  if (isMobile) {
    const itemsToRender = Platform.OS === 'web' ? webMobileItems : allItems;

    return (
      <Container style={[styles.base, mobileStyles.container]}>
        <View
          style={[
            mobileStyles.dockWrapper,
            Platform.OS === 'web' ? ({ minHeight: MOBILE_DOCK_MIN_HEIGHT_WEB } as any) : null,
          ]}
        >
          {/* измеряем ровно эту область */}
          <View onLayout={handleDockLayout} testID="footer-dock-measure">
            {Platform.OS === 'web' ? (
              <View style={[mobileStyles.dockBase, mobileStyles.dockNoWrapWeb]}>
                {itemsToRender.map((item) =>
                  item.externalUrl ? (
                    <Item key={item.key} onPress={() => openURL(item.externalUrl!)} label={item.label}>
                      {item.icon}
                    </Item>
                  ) : (
                    <Item key={item.key} href={item.route} label={item.label}>
                      {item.icon}
                    </Item>
                  )
                )}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[mobileStyles.dockBase, mobileStyles.dockScroll]}
              >
                {itemsToRender.map((item) =>
                  item.externalUrl ? (
                    <Item key={item.key} onPress={() => openURL(item.externalUrl!)} label={item.label}>
                      {item.icon}
                    </Item>
                  ) : (
                    <Item key={item.key} href={item.route} label={item.label}>
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
      <View style={[desktopStyles.bar, isCompactDesktop && desktopStyles.barCompact]}>
        <View style={[desktopStyles.group, isCompactDesktop && desktopStyles.groupCompact]}>
          {primary.map((item) => (
            <Item key={item.key} href={item.route} label={item.label}>
              {item.icon}
            </Item>
          ))}
        </View>

        <View style={[desktopStyles.group, isCompactDesktop && desktopStyles.groupCompact]}>
          {social.map((s) => (
            <Item key={s.key} onPress={() => openURL(s.externalUrl!)} label={s.label}>
              {s.icon}
            </Item>
          ))}
          <Text style={[styles.copy, isCompactDesktop && styles.copyCompact]}>© MeTravel 2020–{new Date().getFullYear()}</Text>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    minHeight: 44,
    borderRadius: 8, // ✅ ИСПРАВЛЕНИЕ: Добавлен borderRadius для hover
    // ✅ ИСПРАВЛЕНИЕ: Добавлены hover-состояния для веб
    ...Platform.select({
      web: {
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
      },
    }),
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,               // Уменьшили расстояние между иконкой и текстом
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
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    ...Platform.select({
      web: {
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
    flexWrap: 'nowrap',
    justifyContent: 'center',
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
        flexWrap: 'wrap',
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
        flexWrap: 'wrap',
        flexShrink: 1,
      } as any,
    }),
  },
  groupCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12 as any,
  },
});

export default Footer;