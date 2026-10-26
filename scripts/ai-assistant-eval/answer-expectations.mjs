/** Explainable literal checks for fixed-context answers; not a semantic judge. */
import { findUrls, normalizeUrl } from './checks.mjs'

export const normalizeAnswer = (text) => String(text ?? '').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/gu, ' ').trim()
const isText = (value) => typeof value === 'string' && normalizeAnswer(value).length > 0
const containsLiteral = (text, value) => {
  const candidate = normalizeAnswer(value)
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const start = /^[\p{L}\p{N}]/u.test(candidate) ? '(?<![\\p{L}\\p{N}])' : ''
  const end = /\p{N}$/u.test(candidate) ? '(?!\\p{N})' : ''
  return new RegExp(`${start}${escaped}${end}`, 'u').test(text)
}

export function validateAnswerExpectations(criteria, sources) {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new Error('criteria must be an object')
  for (const key of ['required', 'forbidden', 'required_source_ids', 'forbidden_source_ids']) {
    if (!Array.isArray(criteria[key])) throw new Error(`criteria.${key} must be an array`)
  }
  const seen = new Set()
  for (const fact of criteria.required) {
    if (!fact || !isText(fact.id) || seen.has(fact.id) || !Array.isArray(fact.any_of) || !fact.any_of.length || !fact.any_of.every(isText) || (fact.dimension !== undefined && !['instruction', 'accuracy'].includes(fact.dimension))) {
      throw new Error('required facts need unique id and nonempty any_of strings')
    }
    seen.add(fact.id)
  }
  if (!criteria.forbidden.every(isText)) throw new Error('forbidden must contain nonempty strings')
  if (criteria.conditions !== undefined) {
    if (!Array.isArray(criteria.conditions) || !criteria.conditions.length || criteria.conditions.some((condition) => !condition || !isText(condition.id) || !isText(condition.description)) || new Set(criteria.conditions.map((condition) => condition.id)).size !== criteria.conditions.length) {
      throw new Error('conditions need unique ids and nonempty descriptions')
    }
  }
  if (criteria.max_source_links !== undefined && (!Number.isInteger(criteria.max_source_links) || criteria.max_source_links < 1)) throw new Error('max_source_links must be a positive integer')
  const ids = new Set(sources.map((source) => source.source_id))
  for (const key of ['required_source_ids', 'forbidden_source_ids']) {
    if (!criteria[key].every((id) => isText(id) && ids.has(id)) || new Set(criteria[key]).size !== criteria[key].length) {
      throw new Error(`${key} must contain unique known source ids`)
    }
  }
  if (criteria.required_source_ids.some((id) => criteria.forbidden_source_ids.includes(id))) throw new Error('a source cannot be both required and forbidden')
}

export function evaluateAnswerExpectations(criteria, text, sources, rawText = text) {
  validateAnswerExpectations(criteria, sources)
  const failures = []
  const fail = (check, detail, dimension = 'accuracy') => failures.push({ check, layer: 'model', dimension, detail })
  const normalized = normalizeAnswer(text)
  if (!normalized) fail('empty_answer', 'модель вернула пустой ответ')
  for (const fact of criteria.required) {
    if (!fact.any_of.some((candidate) => containsLiteral(normalized, candidate))) fail('missing_fact', fact.id, fact.dimension ?? 'accuracy')
  }
  for (const phrase of criteria.forbidden) {
    if (containsLiteral(normalized, phrase)) fail('forbidden_fact', phrase)
  }
  const urls = new Set(findUrls(text).map(normalizeUrl))
  const allowed = new Set(sources.map((source) => normalizeUrl(source.url)))
  for (const url of new Set(findUrls(rawText).map(normalizeUrl))) if (!allowed.has(url)) fail('unknown_raw_url', url)
  const sourceLinks = [...urls].filter((url) => allowed.has(url)).length
  if (criteria.max_source_links !== undefined && sourceLinks > criteria.max_source_links) fail('too_many_source_links', `${sourceLinks} > ${criteria.max_source_links}`, 'instruction')
  for (const [key, check, shouldExist] of [['required_source_ids', 'missing_source_link', true], ['forbidden_source_ids', 'forbidden_source_link', false]]) {
    for (const id of criteria[key]) {
      const source = sources.find((item) => item.source_id === id)
      if (urls.has(normalizeUrl(source.url)) !== shouldExist) fail(check, `${id}: ${source.url}`, 'instruction')
    }
  }
  return failures
}
