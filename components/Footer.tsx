import React, { useRef, useEffect } from "react";
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

const Item = ({
                children,
                onPress,
                href,
                label,
              }: {
  children: React.ReactNode;
  onPress?: () => void;
  href?: Href;
  label: string;
}) => {
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
      <Link href={href} accessibilityRole="link" accessibilityLabel={label} style={styles.item}>
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
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

/** ========= Component ========= */
const palette = DESIGN_TOKENS.colors;

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 900 || Platform.OS !== "web";
  const iconColor = palette.primary;

  const primary: NavItem[] = [
    { key: "home",   label: "Путешествия", route: "/",          icon: <Feather name="home"  size={20} color={iconColor} /> },
    { key: "by",     label: "Беларусь",    route: "/travelsby", icon: <Feather name="globe" size={20} color={iconColor} /> },
    { key: "map",    label: "Карта",       route: "/map",       icon: <Feather name="map"   size={20} color={iconColor} /> },
    { key: "quests", label: "Квесты",      route: "/quests",    icon: <Feather name="flag"  size={20} color={iconColor} /> },
    { key: "about",  label: "О сайте",     route: "/about",     icon: <Feather name="info"  size={20} color={iconColor} /> },
    { key: "blogby", label: "Пишут о BY",  route: "/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi", icon: <Feather name="list" size={20} color={iconColor} /> },
  ];

  const social: NavItem[] = [
    { key: "tt", label: "TikTok",    externalUrl: "https://www.tiktok.com/@metravel.by",   icon: <FontAwesome5 name="tiktok"    size={18} color={iconColor} /> },
    { key: "ig", label: "Instagram", externalUrl: "https://www.instagram.com/metravelby/", icon: <FontAwesome5 name="instagram" size={18} color={iconColor} /> },
    { key: "yt", label: "YouTube",   externalUrl: "https://www.youtube.com/@metravelby",   icon: <FontAwesome5 name="youtube"   size={18} color={iconColor} /> },
  ];

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
    return (
      <Container style={[styles.base, mobileStyles.container]}>
        <View style={mobileStyles.dockWrapper}>
          {/* измеряем ровно эту область */}
          <View onLayout={handleDockLayout} testID="footer-dock-measure">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={mobileStyles.dock}
            >
              {[...primary, ...social].map((item) =>
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
          </View>
        </View>
      </Container>
    );
  }

  /** ======= Desktop: иконка + подпись ======= */

  return (
    <Container style={[styles.base, desktopStyles.container]}>
      <View style={desktopStyles.bar}>
        <View style={desktopStyles.group}>
          {primary.map((item) => (
            <Item key={item.key} href={item.route} label={item.label}>
              {item.icon}
            </Item>
          ))}
        </View>

        <View style={desktopStyles.group}>
          {social.map((s) => (
            <Item key={s.key} onPress={() => openURL(s.externalUrl!)} label={s.label}>
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
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8, // Уменьшили отступы
    paddingVertical: 4,   // Уменьшили отступы
    minWidth: 60,         // Уменьшили минимальную ширину
    minHeight: 44,        // Слегка уменьшили высоту
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
});

/** ========= Mobile ========= */
const mobileStyles = StyleSheet.create({
  container: {
    // @ts-ignore
    position: Platform.OS === "web" ? "sticky" : "relative",
    bottom: 0,
    zIndex: 50,
  },
  dockWrapper: {
    paddingTop: 4,        // Уменьшили отступы
    paddingBottom: 4,     // Уменьшили отступы
    paddingHorizontal: 8, // Уменьшили отступы
    backgroundColor: palette.dockBackground,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.dockBorder,
    shadowColor: "#0f172a",
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
  dock: {
    alignItems: "center",
    gap: 2,               // Уменьшили расстояние между иконками
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
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  group: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 20 as any,
  },
});

export default Footer;