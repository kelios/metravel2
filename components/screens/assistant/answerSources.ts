import { buildSourceByLinkKey, normalizeLinkKey } from '@/api/aiAssist/linkGuard'
import { AI_SOURCE_DISPLAY_FIELDS, type AiSource } from '@/api/aiAssist/types'

/**
 * Источники хода под ответом (#3295): карточки, которые ассистент назвал в тексте, — первыми, в порядке
 * упоминания; остальные — ниже, под «Ещё материалы». Раньше под ответом стоял один список строк, и
 * названное в ответе в нём ничем не отличалось от найденного рядом.
 */
export type AnswerSources = {
  /** Названы в ответе ссылкой — в порядке первого упоминания. */
  recommended: AiSource[]
  /** Остальные источники хода в прежнем порядке. */
  rest: AiSource[]
}

export const splitAnswerSources = (answer: string, sources: readonly AiSource[]): AnswerSources => {
  const byKey = buildSourceByLinkKey(sources)
  const named: AiSource[] = []
  // Адрес карточки стоит в тексте markdown-ссылкой либо голым адресом: слово, чей ключ — ключ карточки.
  for (const word of String(answer ?? '').split(/[\s()[\]<>«»"']+/)) {
    const source = word ? byKey.get(normalizeLinkKey(word)) : undefined
    if (source && !named.includes(source)) named.push(source)
  }
  return { recommended: named, rest: sources.filter((source) => !named.includes(source)) }
}

/**
 * Карточку можно нарисовать с обложкой и действиями: служба прислала поля показа (#3295). У справки о
 * сайте их нет по смыслу; старая служба и провайдер `llamacpp` полей не дают — источник идёт прежней строкой.
 */
export const hasDisplayFields = (source: AiSource): boolean => source.type !== 'help' && AI_SOURCE_DISPLAY_FIELDS.some((field) => source[field] !== undefined)

/** Координаты карточки для «На карте»; `null` — у источника их нет. */
export const sourceCoordinates = (source: Pick<AiSource, 'lat' | 'lng'>): { lat: number; lng: number } | null =>
  typeof source.lat === 'number' && typeof source.lng === 'number' && Number.isFinite(source.lat) && Number.isFinite(source.lng) ? { lat: source.lat, lng: source.lng } : null
