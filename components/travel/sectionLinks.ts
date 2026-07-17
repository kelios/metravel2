import { Platform } from "react-native"

import type { Travel } from "@/types/types"
import { translate as i18nT } from '@/i18n'


export type TravelSectionLink = {
  key: string
  icon: string
  label: string
  meta?: string
}

type BuildTravelSectionLinksOptions = {
  platform?: typeof Platform.OS
}

const pushIf = (
  condition: boolean,
  list: TravelSectionLink[],
  link: TravelSectionLink,
) => {
  if (condition) {
    list.push(link)
  }
}

export const buildTravelSectionLinks = (
  travel?: Travel | null,
  options: BuildTravelSectionLinksOptions = {},
): TravelSectionLink[] => {
  if (!travel) return []
  const platform = options.platform ?? Platform.OS

  const hasGallery = Array.isArray(travel.gallery) && travel.gallery.length > 0
  const hasVideo = typeof travel.youtube_link === "string" && travel.youtube_link.length > 0
  const desc = typeof travel.description === "string" ? travel.description.trim() : ""
  const isDraft = (travel as any).publish === false || (travel as any).moderation === false
  // For drafts we keep the "Описание" link even when description is empty,
  // so the preview page doesn't look broken/stuck.
  const hasDescription = desc.length > 0 || isDraft
  const hasRecommendation =
    typeof travel.recommendation === "string" && travel.recommendation.trim().length > 0
  const hasPlus = typeof travel.plus === "string" && travel.plus.trim().length > 0
  const hasMinus = typeof travel.minus === "string" && travel.minus.trim().length > 0
  const hasTravelAddress = Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0

  const links: TravelSectionLink[] = []

  pushIf(hasGallery, links, { key: "gallery", icon: "image", label: i18nT('travel:components.travel.sectionLinks.galereya_20119b40') })
  pushIf(hasDescription, links, { key: "description", icon: "file-text", label: i18nT('travel:components.travel.sectionLinks.opisanie_80e1d1ba') })
  pushIf(hasVideo, links, { key: "video", icon: "video", label: i18nT('travel:components.travel.sectionLinks.video_5ff9084b') })
  pushIf(hasRecommendation, links, { key: "recommendation", icon: "thumbs-up", label: i18nT('travel:components.travel.sectionLinks.rekomendatsii_83cdaba4') })
  pushIf(hasPlus, links, { key: "plus", icon: "plus", label: i18nT('travel:components.travel.sectionLinks.plyusy_80285d53') })
  pushIf(hasMinus, links, { key: "minus", icon: "minus", label: i18nT('travel:components.travel.sectionLinks.minusy_722b20a7') })
  pushIf((platform === "web" || platform === "android") && hasTravelAddress, links, { key: "excursions", icon: "compass", label: i18nT('travel:components.travel.sectionLinks.ekskursii_60b416ff') })

  links.push({ key: "map", icon: "map", label: i18nT('travel:components.travel.sectionLinks.karta_marshruta_e95d2bba') })
  pushIf(hasTravelAddress, links, { key: "points", icon: "list", label: i18nT('travel:components.travel.sectionLinks.koordinaty_mest_b024ee27') })
  links.push({ key: "near", icon: "map-pin", label: i18nT('travel:components.travel.sectionLinks.ryadom_mozhno_posmotret_a8f25f47') })
  links.push({ key: "popular", icon: "star", label: i18nT('travel:components.travel.sectionLinks.populyarnye_marshruty_95d66469') })
  links.push({ key: "comments", icon: "message-circle", label: i18nT('travel:components.travel.sectionLinks.kommentarii_80cf82b1') })

  return links
}
