import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

const MEDIA_ROOT = '/travel-games-media'
const MANIFEST_URL = `${MEDIA_ROOT}/manifest.json`
const SLUG = /^[a-z0-9][a-z0-9_-]*$/

type ColoringCollection = { id: string; title: string; pdfUrl: string; sheetCount: number }
export type ColoringSheet = { id: string; travelId: number; placeTitle: string; previewUrl: string; pdfUrl: string }
export type WalkDeckId = 'kids' | 'adults'
export type WalkDeck = { id: WalkDeckId; dataUrl: string; pdfUrl: string }
export type WalkCard = { title: string; body: string }
type GamesMediaManifest = { revision: string; coloringIndexUrl: string; collections: ColoringCollection[]; decks: WalkDeck[] }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function label(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function id(value: unknown): value is string {
  return typeof value === 'string' && SLUG.test(value)
}

function mediaPath(value: unknown, revision: string, extension: 'json' | 'pdf' | 'webp'): value is string {
  const prefix = `${MEDIA_ROOT}/${revision}/`
  return typeof value === 'string' && value.startsWith(prefix) && value.endsWith(`.${extension}`) &&
    SLUG.test(value.slice(prefix.length, -extension.length - 1))
}

function isWalkDeckId(value: unknown): value is WalkDeckId {
  return value === 'kids' || value === 'adults'
}

function parseWalkDecks(payload: unknown, revision: string): WalkDeck[] {
  if (!Array.isArray(payload)) return []
  const seen = new Set<WalkDeckId>()
  const decks: WalkDeck[] = []
  // Walk publications are optional. A broken deck entry must not hide coloring assets.
  for (const entry of payload) {
    const deck = record(entry)
    if (!deck || !isWalkDeckId(deck.id) || seen.has(deck.id) ||
        !mediaPath(deck.dataUrl, revision, 'json') || !mediaPath(deck.pdfUrl, revision, 'pdf')) {
      continue
    }
    seen.add(deck.id)
    decks.push({ id: deck.id, dataUrl: deck.dataUrl, pdfUrl: deck.pdfUrl })
  }
  return decks
}

export function parseGamesMediaManifest(payload: unknown): GamesMediaManifest {
  const manifest = record(payload)
  if (!manifest || manifest.schemaVersion !== 1 || !id(manifest.revision) ||
      !mediaPath(manifest.coloringIndexUrl, manifest.revision, 'json') || !Array.isArray(manifest.collections)) {
    throw new Error('Invalid games media manifest')
  }
  const { revision, coloringIndexUrl } = manifest
  const seen = new Set<string>()
  const collections = manifest.collections.map((entry: unknown) => {
    const collection = record(entry)
    if (!collection || !id(collection.id) || seen.has(collection.id) || !label(collection.title) ||
        !mediaPath(collection.pdfUrl, revision, 'pdf') || !positiveInteger(collection.sheetCount)) {
      throw new Error('Invalid coloring collection')
    }
    seen.add(collection.id)
    return { id: collection.id, title: collection.title, pdfUrl: collection.pdfUrl, sheetCount: collection.sheetCount }
  })
  return { revision, coloringIndexUrl, collections, decks: parseWalkDecks(manifest.decks, revision) }
}

export function parseWalkCards(payload: unknown, id: WalkDeckId): WalkCard[] {
  const deck = record(payload)
  if (!deck || deck.schemaVersion !== 1 || deck.id !== id || !Array.isArray(deck.cards) || deck.cards.length !== 12) {
    throw new Error('Invalid walk card list')
  }
  return deck.cards.map((entry: unknown) => {
    const card = record(entry)
    if (!card || !label(card.title) || !label(card.body)) throw new Error('Invalid walk card')
    return { title: card.title, body: card.body }
  })
}

export function parseColoringSheets(payload: unknown, revision: string): ColoringSheet[] {
  const index = record(payload)
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.sheets)) {
    throw new Error('Invalid coloring sheet index')
  }
  const seen = new Set<string>()
  return index.sheets.map((entry: unknown) => {
    const sheet = record(entry)
    if (!sheet || !id(sheet.id) || seen.has(sheet.id) || !positiveInteger(sheet.travelId) || !label(sheet.placeTitle) ||
        !mediaPath(sheet.previewUrl, revision, 'webp') || !mediaPath(sheet.pdfUrl, revision, 'pdf')) {
      throw new Error('Invalid coloring sheet')
    }
    seen.add(sheet.id)
    return {
      id: sheet.id, travelId: sheet.travelId, placeTitle: sheet.placeTitle,
      previewUrl: sheet.previewUrl, pdfUrl: sheet.pdfUrl,
    }
  })
}

async function loadJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetchWithTimeout(path, { credentials: 'omit', redirect: 'error', signal })
  if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error(`Games media response unavailable (${response.status})`)
  }
  return response.json()
}

export function useGamesMediaManifest() {
  return useQuery({
    queryKey: queryKeys.gamesMediaManifest(),
    queryFn: async ({ signal }) => parseGamesMediaManifest(await loadJson(MANIFEST_URL, signal)),
    staleTime: 60_000,
    retry: false,
  })
}

export function useColoringSheets() {
  const { data: manifest } = useGamesMediaManifest()
  return useQuery({
    queryKey: queryKeys.coloringSheetIndex(manifest?.coloringIndexUrl),
    queryFn: async ({ signal }) => manifest
      ? parseColoringSheets(await loadJson(manifest.coloringIndexUrl, signal), manifest.revision)
      : [],
    enabled: Boolean(manifest),
    staleTime: Infinity,
    retry: false,
  })
}

export function useWalkCards(deck: WalkDeck) {
  return useQuery({
    queryKey: queryKeys.walkDeck(deck.dataUrl, deck.id),
    queryFn: async ({ signal }) => parseWalkCards(await loadJson(deck.dataUrl, signal), deck.id),
    staleTime: Infinity,
    retry: false,
  })
}
