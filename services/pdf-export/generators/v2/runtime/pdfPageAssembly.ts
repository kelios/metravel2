import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { TravelForBook } from '@/types/pdf-export'

import type { NormalizedLocation, TravelSectionMeta } from './types'

type AssembleBookPagesArgs = {
  coverPage: string
  meta: TravelSectionMeta[]
  qrCodes: string[]
  settings: BookSettings
  sortedTravels: TravelForBook[]
  renderTocPage: (meta: TravelSectionMeta[], pageNumber: number) => string
  renderSeparatorPage: (
    travel: TravelForBook,
    travelIndex: number,
    totalTravels: number,
  ) => string
  renderTravelPhotoPage: (travel: TravelForBook, pageNumber: number) => string
  renderTravelContentPage: (
    travel: TravelForBook,
    qrCodeDataUrl: string,
    pageNumber: number,
  ) => string
  renderGalleryPages: (travel: TravelForBook, startPageNumber: number) => string[]
  renderMapPage: (
    travel: TravelForBook,
    locations: NormalizedLocation[],
    pageNumber: number,
  ) => Promise<string>
  renderChecklistPage: (settings: BookSettings, pageNumber: number) => string | null
  renderFinalPage: (pageNumber: number, travels: TravelForBook[]) => string
}

export async function assembleBookPages({
  coverPage,
  meta,
  qrCodes,
  settings,
  sortedTravels,
  renderTocPage,
  renderSeparatorPage,
  renderTravelPhotoPage,
  renderTravelContentPage,
  renderGalleryPages,
  renderMapPage,
  renderChecklistPage,
  renderFinalPage,
}: AssembleBookPagesArgs): Promise<string[]> {
  const pages: string[] = [coverPage]
  let currentPage = settings.includeToc ? 3 : 2

  if (settings.includeToc) {
    pages.push(renderTocPage(meta, 2))
  }

  const useSeparators = meta.length >= 3

  for (let index = 0; index < meta.length; index++) {
    const item = meta[index]
    const travel = item.travel

    if (useSeparators && index > 0) {
      pages.push(renderSeparatorPage(travel, index + 1, meta.length))
    }

    pages.push(renderTravelPhotoPage(travel, currentPage))
    currentPage++

    pages.push(renderTravelContentPage(travel, qrCodes[index], currentPage))
    currentPage++

    if (item.hasGallery) {
      const galleryPages = renderGalleryPages(travel, currentPage)
      pages.push(...galleryPages)
      currentPage += galleryPages.length
    }

    if (item.hasMap) {
      const mapPage = await renderMapPage(travel, item.locations, currentPage)
      pages.push(mapPage)
      currentPage++
    }
  }

  if (settings.includeChecklists) {
    const checklistPage = renderChecklistPage(settings, currentPage)
    if (checklistPage) {
      pages.push(checklistPage)
      currentPage++
    }
  }

  pages.push(renderFinalPage(currentPage, sortedTravels))

  return pages
}
