'use strict'

/**
 * scripts/lib/questTranslation/checks.js
 * Структурные проверки перевода квеста — без сети и детерминированные (#2199).
 *
 * Перевод квеста рискованнее перевода статьи: потерянный вариант ответа делает
 * точку непроходимой, а переведённая надпись с таблички — нечитаемой на месте.
 * Линтеры русского контента (`scan-quest-*`) рассчитаны на кириллицу и к
 * переводам неприменимы, поэтому правила перевода живут здесь одним набором:
 * их читают и `quest:translate check`, и гейт публикации в `upload`.
 *
 * Вход — задание `prepare` (снимок русского источника) и файл перевода в форме
 * тела `PUT /api/quests/{id}/translations/{locale}/`. Выход — плоский список
 * `{ step_id, check, ok, detail }`: `step_id` — числовой id шага из API, `null`
 * у проверок уровня квеста (название, финал, набор шагов).
 *
 * Смысловую проверку («ответ достижим, смысл легенды сохранён») делает
 * независимый агент; его вердикт привязан к хешу перевода и подмешивается сюда
 * же (`mergeReview`), чтобы у гейта публикации был один список.
 */

const crypto = require('crypto')

const EXACT_ANSWER_TYPES = new Set(['exact', 'exact_any'])
const STEP_TEXT_FIELDS = ['title', 'location', 'story', 'task', 'hint']
const STEP_POI_FIELDS = ['poi_opening_hours', 'poi_ticket_price']
const STEP_FIELDS = [...STEP_TEXT_FIELDS, ...STEP_POI_FIELDS]
// Ровно те поля, пустоту которых отклоняет сервер (`translation_serializers.py`).
const SERVER_REQUIRED_STEP_FIELDS = ['title', 'story', 'task']
const ORIGINS = new Set(['machine', 'human'])
const STATUSES = new Set(['draft', 'published'])
const LENGTH_RATIO = { min: 0.6, max: 1.6, minSourceChars: 80 }
// Проверки, без которых сервер всё равно ответит 400 либо черновик бессмыслен.
// `origin` — без него черновик навсегда запирает машинный шаг как ручной.
const DRAFT_BLOCKING_CHECKS = new Set(['shape', 'step_set', 'required_fields', 'origin'])

const CYRILLIC = /[\u0400-\u04FF]/
/**
 * Правило письма по локали: что в тексте перевода выдаёт непереведённый кусок.
 * Ключи обязаны совпадать с целевыми локалями `i18n/config.ts` — это держит
 * тест, поэтому новый язык приложения без правила здесь роняет набор.
 */
const SCRIPT_RULES = {
  be: { forbidden: /[ищъ]/i, what: 'буквы и/щ/ъ (в белорусском их нет)' },
  uk: { forbidden: /[ыэъё]/i, what: 'буквы ы/э/ъ/ё (в украинском их нет)' },
  pl: { forbidden: CYRILLIC, what: 'кириллица' },
  en: { forbidden: CYRILLIC, what: 'кириллица' },
}

// Цитата — «как на табличке»: надпись и название в оригинале правилом письма не проверяются.
const QUOTED = /«[^»]*»|„[^“”"]*[“”"]|“[^”]*”|"[^"]*"/g

const asText = (value) => (typeof value === 'string' ? value : '')
const isBlank = (value) => asText(value).trim() === ''
const outsideQuotes = (value) => asText(value).replace(QUOTED, ' ')
const joinFields = (row, fields) => fields.map((field) => asText(row && row[field])).join('\n')

/** «1 200», «1,200» и «1200» — одно число: разделитель разрядов не значим. */
const digitTokens = (value) =>
  asText(value)
    .replace(/(\d)[\s\u00A0\u202F,.](?=\d{3}(?:\D|$))/g, '$1')
    .match(/\d+/g) || []

const extractUrls = (value) =>
  (asText(value).match(/https?:\/\/[^\s<>«»"']+/g) || []).map((url) => url.replace(/[).,;:!?]+$/, ''))

/** Свёртка для сравнения «вариант ответа ↔ подсказка»: регистр, диакритика, пунктуация. */
const fold = (value) =>
  asText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const containsPhrase = (haystack, needle) => Boolean(needle) && ` ${haystack} `.includes(` ${needle} `)

function missingNumbers(sourceText, translatedText) {
  const have = new Set(digitTokens(translatedText))
  const haveList = [...have]
  return [...new Set(digitTokens(sourceText))].filter((token) => {
    if (have.has(token)) return false
    // «40-е годы» → «the 1940s»: двузначный остаток года закрыт полным годом.
    return !(token.length === 2 && haveList.some((other) => other.length === 4 && other.endsWith(token)))
  })
}

/** Хеш содержимого перевода: к нему привязан вердикт смысловой проверки. */
function translationDigest(translation) {
  const steps = Array.isArray(translation && translation.steps) ? translation.steps : []
  const canonical = {
    title: asText(translation && translation.title),
    finale: translation && translation.finale ? asText(translation.finale.text) : null,
    steps: steps.map((step) => ({
      step_id: step && step.step_id,
      ...Object.fromEntries(STEP_FIELDS.map((field) => [field, asText(step && step[field])])),
      answer_variants: Array.isArray(step && step.answer_variants) ? step.answer_variants : [],
    })),
  }
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/**
 * К чему привязан вердикт смысловой проверки: к переводу И к русскому источнику,
 * по которому его проверяли. Иначе правка источника между проверкой и повторным
 * `prepare` оставила бы в силе вердикт о тексте, которого уже нет.
 */
function reviewDigest({ task, translation }) {
  return crypto
    .createHash('sha256')
    .update(`${translationDigest(translation)}\n${JSON.stringify(task.source)}`)
    .digest('hex')
}

const stepLabel = (sourceStep) => `шаг «${sourceStep.slug}» (${sourceStep.title})`

function checkShape(translation) {
  const problems = []
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    return ['файл перевода — не JSON-объект']
  }
  if (typeof translation.title !== 'string') problems.push('title — не строка')
  if (!STATUSES.has(translation.status)) problems.push('status — не draft|published')
  if (!Array.isArray(translation.steps)) return [...problems, 'steps — не массив']
  if (translation.finale != null && typeof translation.finale.text !== 'string') {
    problems.push('finale.text — не строка')
  }
  translation.steps.forEach((step, index) => {
    const at = `steps[${index}]`
    if (!step || typeof step !== 'object') return problems.push(`${at} — не объект`)
    if (!Number.isInteger(step.step_id)) problems.push(`${at}.step_id — не целое число (нужен числовой id шага из задания)`)
    if (!ORIGINS.has(step.origin)) problems.push(`${at}.origin — не machine|human`)
    if (!Array.isArray(step.answer_variants) || step.answer_variants.some((v) => typeof v !== 'string')) {
      problems.push(`${at}.answer_variants — не массив строк`)
    }
    for (const field of STEP_FIELDS) {
      if (step[field] != null && typeof step[field] !== 'string') problems.push(`${at}.${field} — не строка`)
    }
    return undefined
  })
  return problems
}

function checkStepSet(sourceSteps, translatedSteps) {
  const sourceIds = new Set(sourceSteps.map((step) => step.step_id))
  const seen = new Set()
  const problems = []
  for (const step of translatedSteps) {
    if (!sourceIds.has(step.step_id)) problems.push(`лишний step_id ${step.step_id} — такого шага нет в источнике`)
    if (seen.has(step.step_id)) problems.push(`step_id ${step.step_id} повторяется`)
    seen.add(step.step_id)
  }
  for (const step of sourceSteps) {
    if (!seen.has(step.step_id)) problems.push(`нет перевода: ${stepLabel(step)}, step_id ${step.step_id}`)
  }
  return problems
}

function checkScript(locale, label, row, fields) {
  const rule = SCRIPT_RULES[locale]
  const hits = fields.filter((field) => rule.forbidden.test(outsideQuotes(row[field])))
  return hits.length
    ? `${label}: ${rule.what} вне цитат в полях ${hits.join(', ')}`
    : ''
}

function checkLengthRatio(label, sourceText, translatedText) {
  const sourceLength = sourceText.trim().length
  if (sourceLength < LENGTH_RATIO.minSourceChars) return ''
  const ratio = translatedText.trim().length / sourceLength
  if (ratio >= LENGTH_RATIO.min && ratio <= LENGTH_RATIO.max) return ''
  return `${label}: длина перевода ${ratio.toFixed(2)} от источника (допуск ${LENGTH_RATIO.min}–${LENGTH_RATIO.max})`
}

function checkAnswerVariants(locale, label, sourceStep, step) {
  const variants = step.answer_variants
  if (!EXACT_ANSWER_TYPES.has(sourceStep.answer_type)) {
    return variants.length
      ? `${label}: тип ответа «${sourceStep.answer_type}» не сверяется со списком — answer_variants должен быть пустым`
      : ''
  }
  if (variants.some(isBlank)) return `${label}: пустой вариант ответа`
  const rule = SCRIPT_RULES[locale]
  const inLocale = variants.filter((variant) => /[\p{L}\p{N}]/u.test(variant) && !rule.forbidden.test(variant))
  return inLocale.length ? '' : `${label}: нет ни одного варианта ответа на языке ${locale}`
}

function checkHintLeak(label, sourceStep, step) {
  if (!EXACT_ANSWER_TYPES.has(sourceStep.answer_type)) return { ok: true, detail: '' }
  const hint = fold(step.hint)
  const leaked = step.answer_variants.filter((variant) => containsPhrase(hint, fold(variant)))
  if (!leaked.length) return { ok: true, detail: '' }
  const sourceHint = fold(sourceStep.hint)
  const sourceLeaks = (sourceStep.answer_variants || []).some((variant) => containsPhrase(sourceHint, fold(variant)))
  // Перевод не должен вносить утечку; утечка самого источника — дефект источника.
  return sourceLeaks
    ? { ok: true, detail: `${label}: ответ есть в подсказке, но так же и в русском источнике` }
    : { ok: false, detail: `${label}: подсказка выдаёт ответ «${leaked[0]}»` }
}

function checkKeptStep(label, existingStep, step) {
  const changed = [...STEP_FIELDS, 'origin'].filter((field) => asText(existingStep[field]) !== asText(step[field]))
  const sameVariants = JSON.stringify(existingStep.answer_variants || []) === JSON.stringify(step.answer_variants)
  if (!changed.length && sameVariants) return ''
  return `${label}: шаг не входит в задание и должен совпадать с принятым переводом (изменены: ${[
    ...changed,
    ...(sameVariants ? [] : ['answer_variants']),
  ].join(', ')})`
}

/**
 * Все структурные проверки одного перевода.
 * @param {{ task: object, translation: object }} input задание `prepare` и файл перевода
 * @returns {{ step_id: number|null, check: string, ok: boolean, detail: string }[]}
 */
function runStructuralChecks({ task, translation }) {
  const locale = task.locale
  if (!SCRIPT_RULES[locale]) throw new Error(`нет правила письма для локали ${locale}`)
  const checks = []
  const add = (stepId, check, detail) => checks.push({ step_id: stepId, check, ok: !detail, detail: detail || '' })

  const shapeProblems = checkShape(translation)
  add(null, 'shape', shapeProblems.join('; '))
  if (shapeProblems.length) return checks

  const sourceSteps = task.source.steps
  add(null, 'step_set', checkStepSet(sourceSteps, translation.steps).join('; '))

  const titleRow = { title: translation.title }
  add(null, 'required_fields', isBlank(translation.title) ? 'название квеста пусто' : '')
  add(null, 'script', checkScript(locale, 'название квеста', titleRow, ['title']))

  const sourceFinale = task.source.finale
  if (sourceFinale) {
    const finaleText = translation.finale ? translation.finale.text : ''
    add(null, 'finale', isBlank(finaleText) ? 'финал: у источника есть финальный текст, в переводе его нет' : '')
    if (!isBlank(finaleText)) {
      add(null, 'script', checkScript(locale, 'финал', { text: finaleText }, ['text']))
      const lost = missingNumbers(sourceFinale.text, finaleText)
      add(null, 'numbers', lost.length ? `финал: потеряны числа ${lost.join(', ')}` : '')
      add(null, 'length_ratio', checkLengthRatio('финал', sourceFinale.text, finaleText))
    }
  } else {
    add(null, 'finale', translation.finale ? 'финал: у источника нет финального текста, в переводе он есть' : '')
  }

  const translate = new Set(task.translate_step_ids)
  const existingById = new Map(((task.existing && task.existing.steps) || []).map((step) => [step.step_id, step]))
  const translatedById = new Map(translation.steps.map((step) => [step.step_id, step]))

  for (const sourceStep of sourceSteps) {
    const step = translatedById.get(sourceStep.step_id)
    if (!step) continue
    const id = sourceStep.step_id
    const label = stepLabel(sourceStep)

    const empty = STEP_FIELDS.filter(
      (field) => isBlank(step[field]) && (SERVER_REQUIRED_STEP_FIELDS.includes(field) || !isBlank(sourceStep[field])),
    )
    add(id, 'required_fields', empty.length ? `${label}: пустые поля ${empty.join(', ')}` : '')
    add(id, 'script', checkScript(locale, label, step, STEP_FIELDS))

    const lost = missingNumbers(joinFields(sourceStep, STEP_FIELDS), joinFields(step, STEP_FIELDS))
    add(id, 'numbers', lost.length ? `${label}: потеряны числа ${lost.join(', ')}` : '')

    const translatedUrls = new Set(extractUrls(joinFields(step, STEP_FIELDS)))
    const lostUrls = extractUrls(joinFields(sourceStep, STEP_FIELDS)).filter((url) => !translatedUrls.has(url))
    add(id, 'urls', lostUrls.length ? `${label}: потеряны ссылки ${lostUrls.join(', ')}` : '')

    add(
      id,
      'length_ratio',
      checkLengthRatio(label, joinFields(sourceStep, STEP_TEXT_FIELDS), joinFields(step, STEP_TEXT_FIELDS)),
    )
    add(id, 'answer_variants', checkAnswerVariants(locale, label, sourceStep, step))

    const leak = checkHintLeak(label, sourceStep, step)
    checks.push({ step_id: id, check: 'hint_leak', ok: leak.ok, detail: leak.detail })

    if (!translate.has(id) && existingById.has(id)) {
      add(id, 'kept_steps', checkKeptStep(label, existingById.get(id), step))
    }
    // `human` закрывает шаг от следующих переводов без --force: машинный текст так помечать нельзя.
    if (translate.has(id) && step.origin !== 'machine') {
      add(id, 'origin', `${label}: переведённый шаг должен иметь origin: machine`)
    }
  }
  return checks
}

/**
 * Вердикты смысловой проверки как записи `semantic`. Нет файла вердикта — записей
 * нет (перевод ещё не проверен); вердикт от другой версии перевода — отказ.
 */
function mergeReview({ task, translation, review }) {
  if (!review) return []
  // `null` — вердикт по названию и финалу: название у квеста есть всегда, даже без финала.
  const expected = [...task.source.steps.map((step) => step.step_id), null]
  if (review.translation_sha256 !== reviewDigest({ task, translation })) {
    return expected.map((stepId) => ({
      step_id: stepId,
      check: 'semantic',
      ok: false,
      detail: 'вердикт вынесен по другой версии перевода или источника — нужна повторная смысловая проверка',
    }))
  }
  const verdicts = new Map((Array.isArray(review.verdicts) ? review.verdicts : []).map((v) => [v.step_id, v]))
  return expected.map((stepId) => {
    const verdict = verdicts.get(stepId)
    if (!verdict || typeof verdict.ok !== 'boolean') {
      return { step_id: stepId, check: 'semantic', ok: false, detail: 'нет вердикта проверяющего' }
    }
    return { step_id: stepId, check: 'semantic', ok: verdict.ok, detail: asText(verdict.detail) }
  })
}

/** Что мешает записать черновик и что — опубликовать. Пустой список = можно. */
function uploadBlockers(checks, { publish }) {
  const failed = checks.filter((entry) => !entry.ok)
  if (!publish) return failed.filter((entry) => DRAFT_BLOCKING_CHECKS.has(entry.check)).map((entry) => entry.detail)
  const blockers = failed.map((entry) => `${entry.check}: ${entry.detail}`)
  if (!checks.some((entry) => entry.check === 'semantic')) {
    blockers.push('semantic: смысловая проверка не проведена')
  }
  return blockers
}

module.exports = {
  DRAFT_BLOCKING_CHECKS,
  EXACT_ANSWER_TYPES,
  LENGTH_RATIO,
  SCRIPT_RULES,
  STEP_FIELDS,
  digitTokens,
  fold,
  mergeReview,
  missingNumbers,
  runStructuralChecks,
  reviewDigest,
  translationDigest,
  uploadBlockers,
}
