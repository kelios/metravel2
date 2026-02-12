import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { ResponsiveContainer } from "@/components/layout";
import { useRouter, type Href } from "expo-router";
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from "@/hooks/useTheme";
import { DESIGN_TOKENS } from "@/constants/designSystem";
import { globalFocusStyles } from "@/styles/globalFocus";
import { openExternalUrl } from '@/utils/externalLinks';

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


const openURL = (url: string) => openExternalUrl(url, {
  onError: (error) => {
    if (__DEV__) {
      console.warn('[FooterDesktop] Не удалось открыть URL:', error);
    }
  },
});

function FooterDesktop({ testID }: FooterDesktopProps) {
  const colors = useThemedColors();
  const iconColor = colors.primary;

  const styles = useMemo(() => StyleSheet.create({
    base: {
      backgroundColor: colors.background,
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
      ...Platform.select({
        web: {
          boxShadow: (colors.boxShadows as any)?.medium ?? "0 12px 32px rgba(0,0,0,0.18)",
        } as any,
        ios: {
          ...DESIGN_TOKENS.shadowsNative.light,
        },
        android: {
          ...DESIGN_TOKENS.shadowsNative.light,
        },
        default: {},
      }),
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
      paddingHorizontal: 6,
      paddingVertical: 4,
      minWidth: 32,
      minHeight: 32,
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
      width: 20,
      height: 20,
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
      fontSize: 12,
      lineHeight: 16,
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
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    byBadgeText: {
      color: colors.textOnPrimary,
      fontSize: 7,
      lineHeight: 8,
      fontWeight: "700",
    },
	    copy: {
	      color: colors.textMuted,
	      fontSize: 12,
	      lineHeight: 16,
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


  const utilityLinks: LinkItem[] = [
    { key: "about", label: "О сайте", route: "/about" as any },
    { key: "privacy", label: "Политика", route: "/privacy" as any },
    { key: "cookies", label: "Cookies", route: "/cookies" as any },
  ];

  const social: LinkItem[] = [
    {
      key: "tt",
      label: "TikTok",
      externalUrl: "https://www.tiktok.com/@metravel.by",
      icon: <Feather name="music" size={18} color={iconColor} />,
    },
    {
      key: "ig",
      label: "Instagram",
      externalUrl: "https://www.instagram.com/metravelby/",
      icon: <Feather name="instagram" size={18} color={iconColor} />,
    },
    {
      key: "yt",
      label: "YouTube",
      externalUrl: "https://www.youtube.com/@metravelby",
      icon: <Feather name="youtube" size={18} color={iconColor} />,
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
          <View style={styles.topRow}>
            <View style={styles.socialRow}>
              {social.map((i) => renderItem(i, { showLabel: false }))}
            </View>

            <View style={styles.utilityRow}>
              {utilityLinks.map((i) => renderItem(i))}
            </View>

            <Text style={styles.copy} numberOfLines={1}>
              © MeTravel 2020–{new Date().getFullYear()}
            </Text>
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(FooterDesktop);
