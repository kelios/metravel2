import type { ComponentProps } from "react";
import type { Href } from "expo-router";
import type Feather from "@expo/vector-icons/Feather";

type FooterDesktopLinkItem = {
  key: string;
  label: string;
  route?: Href;
  externalUrl?: string;
  iconName?: ComponentProps<typeof Feather>["name"];
};

export const FOOTER_DESKTOP_UTILITY_LINKS: FooterDesktopLinkItem[] = [
  { key: "about", label: "О сайте", route: "/about" as Href },
  { key: "privacy", label: "Политика", route: "/privacy" as Href },
  { key: "cookies", label: "Cookies", route: "/cookies" as Href },
];

export function getFooterDesktopSocialLinks(): FooterDesktopLinkItem[] {
  return [
    {
      key: "tt",
      label: "TikTok",
      externalUrl: "https://www.tiktok.com/@metravel.by",
      iconName: "music",
    },
    {
      key: "ig",
      label: "Instagram",
      externalUrl: "https://www.instagram.com/metravelby/",
      iconName: "instagram",
    },
    {
      key: "yt",
      label: "YouTube",
      externalUrl: "https://www.youtube.com/@metravelby",
      iconName: "youtube",
    },
  ];
}

export function getFooterDesktopCopyright() {
  return `© MeTravel 2020–${new Date().getFullYear()}`;
}

export type { FooterDesktopLinkItem };
