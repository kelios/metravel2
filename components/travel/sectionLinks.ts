import type { Travel } from "@/src/types/types"

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
  const hasDescription = typeof travel.description === "string" && travel.description.trim().length > 0
  const hasRecommendation =
    typeof travel.recommendation === "string" && travel.recommendation.trim().length > 0
  const hasPlus = typeof travel.plus === "string" && travel.plus.trim().length > 0
  const hasMinus = typeof travel.minus === "string" && travel.minus.trim().length > 0
  const hasTravelAddress = Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0

  const links: TravelSectionLink[] = []

  pushIf(hasGallery, links, { key: "gallery", icon: "photo-library", label: "Галерея" })
  pushIf(hasVideo, links, { key: "video", icon: "ondemand-video", label: "Видео" })
  pushIf(hasDescription, links, { key: "description", icon: "description", label: "Описание" })
  pushIf(hasRecommendation, links, { key: "recommendation", icon: "recommend", label: "Рекомендации" })
  pushIf(hasPlus, links, { key: "plus", icon: "add", label: "Плюсы" })
  pushIf(hasMinus, links, { key: "minus", icon: "remove", label: "Минусы" })
  pushIf(hasTravelAddress, links, { key: "excursions", icon: "explore", label: "Экскурсии" })

  links.push({ key: "map", icon: "map", label: "Карта" })
  pushIf(hasTravelAddress, links, { key: "points", icon: "list", label: "Координаты" })
  links.push({ key: "near", icon: "location-on", label: "Рядом", meta: "~60км" })
  links.push({ key: "popular", icon: "star", label: "Популярное" })

  return links
}


