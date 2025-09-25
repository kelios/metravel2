import React, { useMemo } from "react";
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
} from "react-native";
import { Link, type Href } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";

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
      <Link
        href={href}
        accessibilityRole="link"
        accessibilityLabel={label}
        style={styles.item}
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
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

/** ========= Component ========= */
const Footer: React.FC = () => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 900 || Platform.OS !== "web";
  const s = useMemo(() => (isMobile ? mobileStyles : desktopStyles), [isMobile]);

  const primary: NavItem[] = [
    { key: "home",   label: "Путешествия", route: "/",          icon: <Feather name="home"  size={20} color="#ff9f5a" /> },
    { key: "by",     label: "Беларусь",    route: "/travelsby", icon: <Feather name="globe" size={20} color="#ff9f5a" /> },
    { key: "map",    label: "Карта",       route: "/map",       icon: <Feather name="map"   size={20} color="#ff9f5a" /> },
    { key: "quests", label: "Квесты",      route: "/quests",    icon: <Feather name="flag"  size={20} color="#ff9f5a" /> },
    { key: "about",  label: "О сайте",     route: "/about",     icon: <Feather name="info"  size={20} color="#ff9f5a" /> },
    { key: "blogby", label: "Пишут о BY",  route: "/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi", icon: <Feather name="list" size={20} color="#ff9f5a" /> },
  ];

  const social: NavItem[] = [
    { key: "tt", label: "TikTok",    externalUrl: "https://www.tiktok.com/@metravel.by",   icon: <FontAwesome5 name="tiktok"    size={18} color="#ff9f5a" /> },
    { key: "ig", label: "Instagram", externalUrl: "https://www.instagram.com/metravelby/", icon: <FontAwesome5 name="instagram" size={18} color="#ff9f5a" /> },
    { key: "yt", label: "YouTube",   externalUrl: "https://www.youtube.com/@metravelby",   icon: <FontAwesome5 name="youtube"   size={18} color="#ff9f5a" /> },
  ];

  const Container = (Platform.OS === "ios" || Platform.OS === "android") ? SafeAreaView : View;

  /** ======= Mobile: компактный «док» ======= */
  if (isMobile) {
    return (
      <Container style={[styles.base, mobileStyles.container]}>
        <View style={mobileStyles.dockWrapper}>
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

          <View style={mobileStyles.brandRow}>
            <Image source={require("../assets/icons/logo_yellow_60x60.png")} style={styles.logo} />
            <Text style={styles.copy}>© MeTravel 2020–{new Date().getFullYear()}</Text>
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
          {primary.map((item) =>
            <Item key={item.key} href={item.route} label={item.label}>
              {item.icon}
            </Item>
          )}
        </View>

        <View style={desktopStyles.group}>
          {social.map((s) =>
            <Item key={s.key} onPress={() => openURL(s.externalUrl!)} label={s.label}>
              {s.icon}
            </Item>
          )}
          <Text style={styles.copy}>© MeTravel 2020–{new Date().getFullYear()}</Text>
        </View>
      </View>
    </Container>
  );
};

/** ========= Common styles ========= */
const styles = StyleSheet.create({
  base: {
    backgroundColor: "#1f1f1f",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a2a",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
    minHeight: 48,
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: "#ffa861",
    fontSize: 11,
    lineHeight: 13,
    marginTop: 3,
    textAlign: "center",
  },
  logo: { width: 18, height: 18, marginRight: 8 },
  copy: { color: "#bdbdbd", fontSize: 13, lineHeight: 16, marginLeft: 12 },
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
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(24,24,24,0.94)",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 14,
  },
  dock: { alignItems: "center" },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2c2c2c",
    marginTop: 6,
    paddingTop: 6,
  },
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
  },
  group: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 20 as any,
  },
});

export default Footer;
