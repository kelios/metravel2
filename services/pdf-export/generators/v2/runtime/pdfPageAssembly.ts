import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { TravelForBook } from '@/types/pdf-export'

import { getTocPageCount, TOC_ITEMS_PER_PAGE } from './bookData'
import type { NormalizedLocation, TravelSectionMeta } from './types'

type AssembleBookPagesArgs = {
  coverPage: string
  meta: TravelSectionMeta[]
  qrCodes: string[]
  settings: BookSettings
  sortedTravels: TravelForBook[]
  renderTocPage: (
    meta: TravelSectionMeta[],
    pageNumber: number,
    totalCount: number,
    startIndex: number,
  ) => string
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
  let currentPage = settings.includeToc ? 2 + getTocPageCount(meta.length) : 2

  if (settings.includeToc) {
    const totalCount = meta.length
    const tocPageCount = getTocPageCount(totalCount)
    for (let pageIndex = 0; pageIndex < tocPageCount; pageIndex += 1) {
      const start = pageIndex * TOC_ITEMS_PER_PAGE
      const end = start + TOC_ITEMS_PER_PAGE
      pages.push(renderTocPage(meta.slice(start, end), 2 + pageIndex, totalCount, start))
    }
  }

  const useSeparators = meta.length >= 3

  for (let index = 0; index < meta.length; index++) {
    const item = meta[index]
    const travel = item.travel

    if (useSeparators && index > 0) {
      pages.push(renderSeparatorPage(travel, index + 1, meta.length))
      currentPage++
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
      // MapPageRenderer может вернуть несколько страниц (основная + продолжения при >6 локациях)
      const mapPageCount = (mapPage.match(/<section\s[^>]*class="[^"]*pdf-page/g) || []).length
      currentPage += Math.max(1, mapPageCount)
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
