import React, { memo } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Platform, ScrollView } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { globalFocusStyles } from "@/styles/globalFocus";

type FooterDesktopProps = {
  testID?: string;
};

type LinkItem = {
  key: string;
  label: string;
  route?: Href;
  externalUrl?: string;
  icon?: React.ReactNode;
};

const palette = DESIGN_TOKENS.colors;

const openURL = (url: string) => Linking.openURL(url).catch(() => {});

const Item = memo(function Item({
  children,
  onPress,
  href,
  label,
  testID,
  showLabel = true,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  href?: Href;
  label: string;
  testID?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();

  const iconNode = React.isValidElement(children) ? (
    children
  ) : typeof children === "string" || typeof children === "number" ? (
    <Text style={styles.iconTextFallback}>{children}</Text>
  ) : null;

  const content = (
    <View style={styles.itemInner}>
      {iconNode ? <View style={styles.iconBox}>{iconNode}</View> : null}
      {showLabel ? (
        <Text
          style={[styles.itemText, !children ? styles.itemTextOnly : null]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      ) : null}
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
        style={({ pressed }) => [styles.item, pressed && styles.pressed, globalFocusStyles.focusable]}
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
      style={({ pressed }) => [styles.item, pressed && styles.pressed, globalFocusStyles.focusable]}
    >
      {content}
    </Pressable>
  );
});

export default function FooterDesktop({ testID }: FooterDesktopProps) {
  const iconColor = palette.primary;

  const InstagramBelarusIcon = (
    <View style={styles.igByIcon}>
      <FontAwesome5 name="instagram" size={16} color={iconColor} />
      <View style={styles.byBadge}>
        <Text style={styles.byBadgeText}>BY</Text>
      </View>
    </View>
  );

  const quickActions: LinkItem[] = [
    { key: "home", label: "Путешествия", route: "/" as any, icon: <Feather name="home" size={16} color={iconColor} /> },
    { key: "map", label: "Карта", route: "/map" as any, icon: <Feather name="map" size={16} color={iconColor} /> },
    { key: "favorites", label: "Избранное", route: "/favorites" as any, icon: <Feather name="heart" size={16} color={iconColor} /> },
    { key: "create", label: "Создать", route: "/travel/new" as any, icon: <Feather name="plus" size={16} color={iconColor} /> },
    { key: "profile", label: "Профиль", route: "/profile" as any, icon: <Feather name="user" size={16} color={iconColor} /> },
  ];

  const featureLink: LinkItem = {
    key: "press",
    label: "Instagram + Беларусь",
    route: "/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi" as any,
    icon: InstagramBelarusIcon,
  };

  const utilityLinks: LinkItem[] = [
    { key: "about", label: "О сайте", route: "/about" as any },
    { key: "privacy", label: "Политика конфиденциальности", route: "/privacy" as any },
    { key: "cookies", label: "Настройки cookies", route: "/cookies" as any },
  ];

  const social: LinkItem[] = [
    {
      key: "tt",
      label: "TikTok",
      externalUrl: "https://www.tiktok.com/@metravel.by",
      icon: <FontAwesome5 name="tiktok" size={14} color={iconColor} />,
    },
    {
      key: "ig",
      label: "Instagram",
      externalUrl: "https://www.instagram.com/metravelby/",
      icon: <FontAwesome5 name="instagram" size={14} color={iconColor} />,
    },
    {
      key: "yt",
      label: "YouTube",
      externalUrl: "https://www.youtube.com/@metravelby",
      icon: <FontAwesome5 name="youtube" size={14} color={iconColor} />,
    },
  ];

  const renderItem = (item: LinkItem, opts?: { showLabel?: boolean }) =>
    item.externalUrl ? (
      <Item
        key={item.key}
        testID={`footer-item-${item.key}`}
        onPress={() => openURL(item.externalUrl!)}
        label={item.label}
        showLabel={opts?.showLabel}
      >
        {item.icon}
      </Item>
    ) : (
      <Item
        key={item.key}
        testID={`footer-item-${item.key}`}
        href={item.route}
        label={item.label}
        showLabel={opts?.showLabel}
      >
        {item.icon}
      </Item>
    );

  return (
    <View style={styles.base} testID={testID || "footer-desktop"}>
      <View style={styles.bar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stack}
        >
          <View style={styles.topRow}>
            <View style={styles.leftGroup}>
              {quickActions.map((i) => renderItem(i, { showLabel: false }))}
              {renderItem(featureLink, { showLabel: false })}
            </View>

            <View style={styles.topRight}>
              <View style={styles.socialRow}>{social.map((i) => renderItem(i, { showLabel: false }))}</View>
              <Text style={styles.copy}>© MeTravel 2020–{new Date().getFullYear()}</Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.bottomLeft} />
            <View style={styles.utilityRow}>{utilityLinks.map((i) => renderItem(i))}</View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    marginTop: -1,
  },
  bar: {
    maxWidth: 1280,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: palette.surface,
    borderRadius: 12,
    shadowColor: "#1f1f1f",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    ...Platform.select({
      web: {
        flexWrap: "nowrap",
        overflowX: "hidden",
        overflowY: "visible",
      } as any,
    }),
  },
  stack: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    flexWrap: "nowrap",
    width: "100%",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "nowrap",
    width: "100%",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8 as any,
    flexWrap: "nowrap",
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    flexWrap: "nowrap",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 2,
  },
  bottomLeft: {
    flexGrow: 1,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6 as any,
    flexWrap: "nowrap",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    flexWrap: "nowrap",
    flexShrink: 1,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 44,
    minHeight: 32,
    borderRadius: 8,
    ...Platform.select({
      web: {
        display: "flex",
        transition: "all 0.2s ease",
        cursor: "pointer",
        ":hover": {
          backgroundColor: palette.primarySoft,
          transform: "scale(1.05)",
        },
        ":active": {
          transform: "scale(1)",
        },
      } as any,
    }),
  },
  pressed: { opacity: 0.7 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconBox: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTextFallback: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 12,
  },
  itemText: {
    color: palette.textMuted,
    fontSize: 9,
    lineHeight: 10,
    marginTop: 0,
    textAlign: "center",
  },
  itemTextOnly: {
    marginTop: 0,
  },
  igByIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  byBadge: {
    position: "absolute",
    right: -5,
    top: -5,
    minWidth: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  byBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    lineHeight: 8,
    fontWeight: "700",
  },
  copy: {
    color: palette.textSubtle,
    fontSize: 10,
    lineHeight: 12,
  },
});
