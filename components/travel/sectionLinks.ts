import type { Travel } from "@/types/types"

export type TravelSectionLink = {
  key: string
  icon: string
  label: string
  meta?: string
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
): TravelSectionLink[] => {
  if (!travel) return []

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

  pushIf(hasGallery, links, { key: "gallery", icon: "image", label: "Галерея" })
  pushIf(hasVideo, links, { key: "video", icon: "video", label: "Видео" })
  pushIf(hasDescription, links, { key: "description", icon: "file-text", label: "Описание" })
  pushIf(hasRecommendation, links, { key: "recommendation", icon: "thumbs-up", label: "Рекомендации" })
  pushIf(hasPlus, links, { key: "plus", icon: "plus", label: "Плюсы" })
  pushIf(hasMinus, links, { key: "minus", icon: "minus", label: "Минусы" })
  pushIf(hasTravelAddress, links, { key: "excursions", icon: "compass", label: "Экскурсии" })

  links.push({ key: "map", icon: "map", label: "Карта" })
  pushIf(hasTravelAddress, links, { key: "points", icon: "list", label: "Координаты" })
  links.push({ key: "near", icon: "map-pin", label: "Рядом", meta: "~60км" })
  links.push({ key: "popular", icon: "star", label: "Популярное" })
  links.push({ key: "comments", icon: "message-circle", label: "Комментарии" })

  return links
}

