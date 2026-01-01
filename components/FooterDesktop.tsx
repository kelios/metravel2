import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { ResponsiveContainer } from "@/components/layout";
import { useRouter, type Href } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useThemedColors } from "@/hooks/useTheme";
import { PRIMARY_HEADER_NAV_ITEMS } from "@/constants/headerNavigation";
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


const openURL = (url: string) => Linking.openURL(url).catch((error) => {
  // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки вместо молчаливого игнорирования
  if (__DEV__) {
    console.warn('[FooterDesktop] Не удалось открыть URL:', error);
  }
});

export default function FooterDesktop({ testID }: FooterDesktopProps) {
  const colors = useThemedColors();
  const iconColor = colors.primary;

  const styles = useMemo(() => StyleSheet.create({
    base: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: -1,
      width: "100%",
    },
    bar: {
      maxWidth: "100%",
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 4,
      backgroundColor: colors.surface,
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
      gap: 12 as any,
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
      marginTop: 0,
    },
    bottomLeft: {
      flexGrow: 1,
    },
    columns: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      width: "100%",
    },
    leftColumn: {
      flex: 1,
      alignItems: "flex-start",
    },
    rightColumn: {
      flex: 1,
      alignItems: "flex-end",
      gap: 8,
    },
    utilityRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6 as any,
      flexWrap: "nowrap",
      flexShrink: 1,
    },
    leftGroup: {
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      flexShrink: 1,
    },
    iconRows: {
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      gap: 6 as any,
    },
    iconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8 as any,
      flexWrap: "nowrap",
    },
    item: {
      alignItems: "center",
      justifyContent: "center",
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: 4,
      paddingVertical: 0,
      minWidth: 32,
      minHeight: 20,
      borderRadius: 6,
      ...Platform.select({
        web: {
          display: "flex",
          transition: "all 0.2s ease",
          cursor: "pointer",
          ":hover": {
            backgroundColor: colors.primarySoft,
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
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 12,
    },
    itemText: {
      color: colors.textMuted,
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
      color: colors.textSubtle,
      fontSize: 10,
      lineHeight: 12,
    },
  }), [colors]);

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


  const InstagramBelarusIcon = (
    <View style={styles.igByIcon}>
      <FontAwesome5 name="instagram" size={16} color={iconColor} />
      <View style={styles.byBadge}>
        <Text style={styles.byBadgeText}>BY</Text>
      </View>
    </View>
  );

  const headerNavActions: LinkItem[] = PRIMARY_HEADER_NAV_ITEMS.map((item) => {
    const safePathKey = item.path
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

    return {
      key: `header-${safePathKey || "root"}`,
      label: item.label,
      route: item.path as any,
      icon: <Feather name={item.icon as any} size={16} color={iconColor} />,
    };
  });

  const extraActions: LinkItem[] = [
    { key: "favorites", label: "Избранное", route: "/favorites" as any, icon: <Feather name="heart" size={16} color={iconColor} /> },
    { key: "profile", label: "Профиль", route: "/profile" as any, icon: <Feather name="user" size={16} color={iconColor} /> },
  ];

  const featureLink: LinkItem = {
    key: "press",
    label: "Instagram + Беларусь",
    route: "/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi" as any,
    icon: InstagramBelarusIcon,
  };

  const shareAction: LinkItem = {
    key: "share",
    label: "Поделиться путешествием",
    route: "/travel/new" as any,
    icon: <Feather name="share-2" size={16} color={iconColor} />,
  };

  const dedupeByRoute = (items: LinkItem[]) =>
    items.filter((item, index, arr) => {
      if (!item.route) return true;
      const routeKey = String(item.route);
      return arr.findIndex((i) => (i.route ? String(i.route) : "") === routeKey) === index;
    });

  const primaryIconActions: LinkItem[] = dedupeByRoute(headerNavActions);
  const primaryRouteKeys = new Set(primaryIconActions.map((i) => (i.route ? String(i.route) : "")));

  const secondaryIconActions: LinkItem[] = dedupeByRoute([
    ...extraActions,
    shareAction,
    featureLink,
  ]).filter((i) => {
    if (!i.route) return true;
    return !primaryRouteKeys.has(String(i.route));
  });

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
      <ResponsiveContainer maxWidth="full" padding={false} paddingHorizontal={false} paddingVertical={false}>
        <View style={styles.bar} testID="footer-desktop-bar">
          <View style={styles.columns}>
            <View style={styles.leftColumn}>
              <View style={styles.iconRows}>
                <View style={styles.iconRow}>{primaryIconActions.map((i) => renderItem(i, { showLabel: false }))}</View>
                <View style={styles.iconRow}>{secondaryIconActions.map((i) => renderItem(i, { showLabel: false }))}</View>
              </View>
            </View>

            <View style={styles.rightColumn}>
              <View style={styles.socialRow}>{social.map((i) => renderItem(i, { showLabel: false }))}</View>
              <View style={styles.utilityRow}>
                {utilityLinks.map((i) => renderItem(i))}
                <Text style={styles.copy} numberOfLines={1}>
                  © MeTravel 2020–{new Date().getFullYear()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

