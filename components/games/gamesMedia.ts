import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { buildTravelPath } from '@/utils/routePaths'

const MEDIA_ROOT = '/travel-games-media'
const MANIFEST_URL = `${MEDIA_ROOT}/manifest.json`
const SLUG = /^[a-z0-9][a-z0-9_-]*$/

type ColoringCollection = { id: string; title: string; pdfUrl: string; sheetCount: number }
export type ColoringSheet = { id: string; travelId: number; placeTitle: string; previewUrl: string; pdfUrl: string }
export type WalkDeckId = 'kids' | 'adults'
export type WalkDeck = { id: WalkDeckId; dataUrl: string; pdfUrl: string }
export type WalkCard = { title: string; body: string }
export type RoadQuizId = 'belarus' | 'poland' | 'world'
export type RoadQuiz = { id: RoadQuizId; dataUrl: string }
type QuizChoice = { id: string; label: string }
export type QuizQuestion = {
  id: string
  prompt: string
  choices: QuizChoice[]
  correctChoiceId: string
  explanation: string
  sourceUrl: string
}
type QuizEdition = { title: string; locale: 'ru'; questions: QuizQuestion[] }
export type RouteTaskEdition = { id: string; travelId: number; travelPath: string; title: string; locale: 'ru'; dataUrl: string }
export type RouteTask = { id: string; pointId: number; title: string; instruction: string }
type GamesMediaManifest = {
  revision: string
  coloringIndexUrl: string
  collections: ColoringCollection[]
  decks: WalkDeck[]
  quizzes: RoadQuiz[]
  routeTasks: RouteTaskEdition[]
}

const QUIZ_QUESTION_COUNT = 10

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

function isRoadQuizId(value: unknown): value is RoadQuizId {
  return value === 'belarus' || value === 'poland' || value === 'world'
}

function parseRoadQuizzes(payload: unknown, revision: string): RoadQuiz[] {
  if (!Array.isArray(payload)) return []
  const quizzes: RoadQuiz[] = []
  const seen = new Set<RoadQuizId>()
  for (const entry of payload) {
    const quiz = record(entry)
    if (!quiz || !isRoadQuizId(quiz.id) || seen.has(quiz.id) || !mediaPath(quiz.dataUrl, revision, 'json')) continue
    seen.add(quiz.id)
    quizzes.push({ id: quiz.id, dataUrl: quiz.dataUrl })
  }
  return quizzes
}

function parseRouteTaskEditions(payload: unknown, revision: string): RouteTaskEdition[] {
  if (!Array.isArray(payload)) return []
  const editions: RouteTaskEdition[] = []
  const ids = new Set<string>()
  const travelIds = new Set<number>()
  const travelPaths = new Set<string>()
  for (const entry of payload) {
    const edition = record(entry)
    if (!edition || !id(edition.id) || ids.has(edition.id) ||
        !positiveInteger(edition.travelId) || travelIds.has(edition.travelId) ||
        !id(edition.travelSlug) || /^\d+$/.test(edition.travelSlug) ||
        !label(edition.title) || edition.locale !== 'ru' ||
        !mediaPath(edition.dataUrl, revision, 'json')) continue

    const travelPath = buildTravelPath(edition.travelSlug)
    if (!travelPath || travelPaths.has(travelPath)) continue

    ids.add(edition.id)
    travelIds.add(edition.travelId)
    travelPaths.add(travelPath)
    editions.push({
      id: edition.id, travelId: edition.travelId, travelPath,
      title: edition.title, locale: edition.locale, dataUrl: edition.dataUrl,
    })
  }
  return editions
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
  return {
    revision, coloringIndexUrl, collections,
    decks: parseWalkDecks(manifest.decks, revision),
    quizzes: parseRoadQuizzes(manifest.quizzes, revision),
    routeTasks: parseRouteTaskEditions(manifest.routeTasks, revision),
  }
}

export function parseRouteTasks(payload: unknown, edition: Pick<RouteTaskEdition, 'id' | 'travelId'>): RouteTask[] {
  const pack = record(payload)
  if (!pack || pack.schemaVersion !== 1 || pack.id !== edition.id || pack.travelId !== edition.travelId ||
      !Array.isArray(pack.tasks) || pack.tasks.length < 3 || pack.tasks.length > 5) {
    throw new Error('Invalid route task edition')
  }
  const ids = new Set<string>()
  const pointIds = new Set<number>()
  return pack.tasks.map((entry: unknown) => {
    const task = record(entry)
    if (!task || !id(task.id) || ids.has(task.id) || !positiveInteger(task.pointId) ||
        pointIds.has(task.pointId) || !label(task.title) || !label(task.instruction)) {
      throw new Error('Invalid route task')
    }
    ids.add(task.id)
    pointIds.add(task.pointId)
    return { id: task.id, pointId: task.pointId, title: task.title, instruction: task.instruction }
  })
}

function isSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function parseQuizChoices(payload: unknown): QuizChoice[] {
  if (!Array.isArray(payload) || payload.length < 3 || payload.length > 4) {
    throw new Error('Invalid quiz choice list')
  }
  const ids = new Set<string>()
  const labels = new Set<string>()
  return payload.map((entry: unknown) => {
    const choice = record(entry)
    if (!choice || !id(choice.id) || ids.has(choice.id) || !label(choice.label)) {
      throw new Error('Invalid quiz choice')
    }
    const displayLabel = choice.label.trim()
    if (labels.has(displayLabel)) throw new Error('Duplicate quiz choice label')
    ids.add(choice.id)
    labels.add(displayLabel)
    return { id: choice.id, label: choice.label }
  })
}

export function parseRoadQuiz(payload: unknown, quizId: RoadQuizId): QuizEdition {
  const quiz = record(payload)
  if (!quiz || quiz.schemaVersion !== 1 || quiz.id !== quizId || quiz.locale !== 'ru' || !label(quiz.title) ||
      !Array.isArray(quiz.questions) || quiz.questions.length !== QUIZ_QUESTION_COUNT) {
    throw new Error('Invalid road quiz')
  }
  const seen = new Set<string>()
  const questions = quiz.questions.map((entry: unknown) => {
    const question = record(entry)
    if (!question || !id(question.id) || seen.has(question.id) || !label(question.prompt) ||
        !id(question.correctChoiceId) || !label(question.explanation) || !isSourceUrl(question.sourceUrl)) {
      throw new Error('Invalid quiz question')
    }
    const choices = parseQuizChoices(question.choices)
    if (!choices.some(choice => choice.id === question.correctChoiceId)) {
      throw new Error('Correct quiz choice is missing')
    }
    seen.add(question.id)
    return {
      id: question.id, prompt: question.prompt, choices, correctChoiceId: question.correctChoiceId,
      explanation: question.explanation, sourceUrl: question.sourceUrl,
    }
  })
  return { title: quiz.title, locale: quiz.locale, questions }
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

export function useRoadQuiz(quiz: RoadQuiz) {
  return useQuery({
    queryKey: queryKeys.roadQuiz(quiz.dataUrl, quiz.id),
    queryFn: async ({ signal }) => parseRoadQuiz(await loadJson(quiz.dataUrl, signal), quiz.id),
    staleTime: Infinity,
    retry: false,
    networkMode: 'always',
  })
}

export function useRouteTasks(edition: RouteTaskEdition) {
  return useQuery({
    queryKey: queryKeys.routeTasks(edition.dataUrl, edition.id, edition.travelId),
    queryFn: async ({ signal }) => parseRouteTasks(await loadJson(edition.dataUrl, signal), edition),
    staleTime: Infinity,
    retry: false,
    networkMode: 'always',
  })
}
