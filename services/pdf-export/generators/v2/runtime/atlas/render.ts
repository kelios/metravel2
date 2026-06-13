// services/pdf-export/generators/v2/runtime/atlas/render.ts
// Сборка страниц атласа: карта-страница + страницы указателя

import { escapeHtml as sharedEscapeHtml } from '../../../../utils/htmlUtils'
import { buildEntries } from './entries'
import { renderAtlasIndexPage, renderAtlasMapPage } from './htmlPages'
import { chunkEntriesForIndex } from './paging'
import { MIN_TRAVELS_FOR_ATLAS, type RenderAtlasPagesArgs } from './types'

export function renderAtlasPages({
  meta,
  theme,
  bookTitle,
  startPageNumber,
  escapeHtml,
}: RenderAtlasPagesArgs): string[] {
  const entries = buildEntries(meta)
  if (entries.length < MIN_TRAVELS_FOR_ATLAS) return []

  const esc = escapeHtml || sharedEscapeHtml
  const totalPoints = entries.reduce((sum, e) => sum + e.pointCount, 0)
  const totalTravels = entries.length

  const indexChunks = chunkEntriesForIndex(entries)
  const totalAtlasPages = 1 + indexChunks.length

  const pages: string[] = []
  pages.push(
    renderAtlasMapPage({
      entries,
      theme,
      pageNumber: startPageNumber,
      totalAtlasPages,
      bookTitle,
      escapeHtml: esc,
    }),
  )

  indexChunks.forEach((chunk, idx) => {
    pages.push(
      renderAtlasIndexPage({
        pageEntries: chunk,
        theme,
        pageNumber: startPageNumber + 1 + idx,
        pageIndex: idx,
        totalAtlasPages,
        totalPoints,
        totalTravels,
        bookTitle,
        escapeHtml: esc,
      }),
    )
  })

  return pages
}
