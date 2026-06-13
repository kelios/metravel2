// services/pdf-export/generators/v2/runtime/atlas/paging.ts
// Пакетирование записей указателя по страницам и подсчёт страниц атласа

import type { TravelSectionMeta } from '../types'
import { buildEntries } from './entries'
import {
  INDEX_ROWS_PER_PAGE,
  MIN_TRAVELS_FOR_ATLAS,
  type AtlasTravelEntry,
} from './types'

export function chunkEntriesForIndex(entries: AtlasTravelEntry[]): AtlasTravelEntry[][] {
  const pages: AtlasTravelEntry[][] = []
  let current: AtlasTravelEntry[] = []
  let rowsLeft = INDEX_ROWS_PER_PAGE
  for (const entry of entries) {
    if (entry.rowsOnIndexPage > INDEX_ROWS_PER_PAGE) {
      // Группа больше страницы — кладём отдельной страницей (CSS-overflow прижмёт)
      if (current.length) {
        pages.push(current)
        current = []
        rowsLeft = INDEX_ROWS_PER_PAGE
      }
      pages.push([entry])
      continue
    }
    if (entry.rowsOnIndexPage > rowsLeft && current.length) {
      pages.push(current)
      current = []
      rowsLeft = INDEX_ROWS_PER_PAGE
    }
    current.push(entry)
    rowsLeft -= entry.rowsOnIndexPage
  }
  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

export function getAtlasPageCount(meta: TravelSectionMeta[]): number {
  const entries = buildEntries(meta)
  if (entries.length < MIN_TRAVELS_FOR_ATLAS) return 0
  const indexPages = chunkEntriesForIndex(entries).length
  return 1 + indexPages
}
