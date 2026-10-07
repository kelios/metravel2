'use strict'

/**
 * scripts/lib/questTranslation/task.js
 * Задание агенту-переводчику и агенту-проверяющему (#2199).
 *
 * Скрипт сам текст не переводит: он снимает русский источник в файл задания,
 * агент `quest-translator` по нему пишет перевод, второй (независимый) проход
 * того же агента выносит смысловой вердикт. Всё, что агенту нужно знать о
 * квесте, лежит в файле задания — проверки потом работают по тому же снимку и
 * без сети, поэтому «источник изменился между prepare и check» не превращается
 * в ложный отказ.
 */

const fs = require('fs')
const path = require('path')

const { EXACT_ANSWER_TYPES, STEP_FIELDS, reviewDigest } = require('./checks')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const GUIDE_PATH = 'docs/QUEST_TRANSLATION_GUIDE.md'
const DEFAULT_WORK_DIR = path.join('.codex-temp', 'quest-translations')
const QUEST_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const GLOSSARY_BLOCK = /<!-- glossary:start -->([\s\S]*?)<!-- glossary:end -->/

function artifactPaths(workDir, locale, questId) {
  if (!QUEST_ID_PATTERN.test(questId)) throw new Error(`quest_id "${questId}" — не slug`)
  const base = path.join(path.resolve(ROOT, workDir), locale, questId)
  return {
    task: `${base}.task.json`,
    translation: `${base}.json`,
    reviewTask: `${base}.review-task.json`,
    review: `${base}.review.json`,
  }
}

const relative = (absolutePath) => path.relative(ROOT, absolutePath)

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

/** Варианты ответа источника: у `exact` — строка, у `exact_any` — JSON-массив (или уже массив). */
function sourceAnswerVariants(pattern) {
  if (!pattern || !EXACT_ANSWER_TYPES.has(pattern.type)) return []
  const value = pattern.value
  if (Array.isArray(value)) return value.map(String)
  if (pattern.type === 'exact') return value == null || value === '' ? [] : [String(value)]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : [String(value)]
  } catch {
    return [String(value)]
  }
}

/** Параметры числового ответа: `value` приходит JSON-строкой либо уже объектом. */
function parsePatternObject(value) {
  if (value && typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Какое число примет сервер у `range` и `approx` — словами. Список вариантов у
 * этих типов пуст, и без правила проверяющий не может решить, достижим ли ответ
 * («сосчитай башенки» → сколько именно сойдёт за верный ответ).
 */
function describeAnswerRule(pattern) {
  const value = parsePatternObject(pattern.value)
  if (!value) return ''
  if (pattern.type === 'range') {
    const [min, max] = [Number(value.min), Number(value.max)]
    return Number.isFinite(min) && Number.isFinite(max) ? `целое число от ${min} до ${max}` : ''
  }
  if (pattern.type === 'approx') {
    const [target, tolerance] = [Number(value.target), Number(value.tolerance)]
    return Number.isFinite(target) && Number.isFinite(tolerance) ? `число около ${target}, допуск ±${tolerance}` : ''
  }
  return ''
}

function sourceStepFromBundle(step) {
  const pattern = step.answer_pattern || {}
  const poi = step.poi_info || {}
  return {
    step_id: step.id,
    slug: step.step_id,
    is_intro: Boolean(step.is_intro),
    title: step.title || '',
    location: step.location || '',
    story: step.story || '',
    task: step.task || '',
    hint: step.hint || '',
    answer_type: pattern.type || 'any',
    answer_variants: sourceAnswerVariants(pattern),
    answer_rule: describeAnswerRule(pattern),
    poi_opening_hours: poi.opening_hours || '',
    poi_ticket_price: poi.ticket_price || '',
  }
}

/** Русский источник квеста в форме, по которой работают перевод и проверки. */
function sourceFromBundle(bundle) {
  const raw = Array.isArray(bundle.steps) ? bundle.steps : JSON.parse(bundle.steps || '[]')
  const byId = new Map()
  for (const step of [...(bundle.intro ? [bundle.intro] : []), ...raw]) {
    if (step && Number.isInteger(step.id) && !byId.has(step.id)) byId.set(step.id, step)
  }
  const ordered = [...byId.values()].sort(
    (a, b) => Number(Boolean(b.is_intro)) - Number(Boolean(a.is_intro)) || (a.order || 0) - (b.order || 0) || a.id - b.id,
  )
  const finaleText = bundle.finale && typeof bundle.finale.text === 'string' ? bundle.finale.text : ''
  return {
    title: bundle.title || '',
    finale: finaleText.trim() ? { text: finaleText } : null,
    steps: ordered.map(sourceStepFromBundle),
  }
}

/** Глоссарий из стайл-гайда: одна таблица `| ru | <локали…> |` между маркерами. */
function parseGlossary(guideText) {
  const block = GLOSSARY_BLOCK.exec(guideText)
  if (!block) throw new Error(`${GUIDE_PATH}: нет блока glossary:start … glossary:end`)
  const rows = block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim()))
  const [header, , ...body] = rows
  if (!header || header[0] !== 'ru') throw new Error(`${GUIDE_PATH}: первая колонка глоссария — не ru`)
  return body
    .filter((cells) => cells.length === header.length && cells[0])
    .map((cells) => Object.fromEntries(header.map((code, index) => [code, cells[index]])))
}

function loadGlossary(locale, guideFile = path.join(ROOT, GUIDE_PATH)) {
  const rows = parseGlossary(fs.readFileSync(guideFile, 'utf8'))
  if (rows.length && !(locale in rows[0])) throw new Error(`${GUIDE_PATH}: в глоссарии нет колонки ${locale}`)
  return rows.map((row) => ({ ru: row.ru, [locale]: row[locale] }))
}

const I18N_ENTRY = /^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/
// Подписи интерфейса квестов: только их квест вправе называть «кнопкой».
const QUEST_UI_KEY = /^(components\.quests\.|utils\.quest)/
// Кнопки карточки шага, которые упоминает почти каждый квест («нажми Далее»,
// «введи ответ и нажми Проверить») — в задании всегда, даже без кавычек в тексте:
// иначе переводчик ищет их по i18n сам и находит не ту подпись.
const WIZARD_UI_LABEL_KEYS = [
  'components.quests.questWizardStepCard.dalee_74add698',
  'components.quests.questWizardStepCard.proverit_otvet_76814505',
]

function readQuestUiStrings(locale, localesDir) {
  const strings = new Map()
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts')) {
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          const match = I18N_ENTRY.exec(line)
          if (match && QUEST_UI_KEY.test(match[1])) strings.set(match[1], JSON.parse(`"${match[2]}"`))
        }
      }
    }
  }
  walk(path.join(localesDir, locale))
  return strings
}

/**
 * Подписи кнопок, на которые ссылается текст квеста («Нажми «Начать квест»»), и
 * кнопки карточки шага — в том виде, в каком их показывает интерфейс на языке
 * перевода. Перевод, придумавший свою подпись, отправит игрока искать кнопку,
 * которой нет.
 */
function collectUiLabels({ source, sourceLocale, locale, localesDir = path.join(ROOT, 'i18n', 'locales') }) {
  const text = [source.title, source.finale ? source.finale.text : '', ...source.steps.flatMap((step) => STEP_FIELDS.map((field) => step[field]))].join('\n')
  const quoted = new Set([...text.matchAll(/«([^«»]{2,60})»/g)].map((match) => match[1].trim()))
  const origin = readQuestUiStrings(sourceLocale, localesDir)
  const target = readQuestUiStrings(locale, localesDir)
  const labels = new Map()
  const add = (key, value) => {
    if (target.has(key) && !labels.has(value)) labels.set(value, { source: value, target: target.get(key) })
  }
  for (const [key, value] of origin) if (quoted.has(value)) add(key, value)
  for (const key of WIZARD_UI_LABEL_KEYS) if (origin.has(key)) add(key, origin.get(key))
  return [...labels.values()]
}

const TRANSLATION_SHAPE = {
  title: '<название квеста>',
  status: 'draft',
  finale: { text: '<финальный текст; null, если у источника финала нет>' },
  steps: [
    {
      step_id: '<число из source.steps[].step_id>',
      title: '…',
      location: '…',
      story: '…',
      task: '…',
      hint: '…',
      answer_variants: ['<только для exact/exact_any; иначе []>'],
      poi_opening_hours: '…',
      poi_ticket_price: '…',
      origin: 'machine',
    },
  ],
}

/**
 * Какие шаги переводить. Опубликованный перевод дополняется только недостающим
 * и устаревшим; ручной перевод (`origin: human`) без `--force` не трогается ни
 * в каком режиме.
 */
function planSteps({ source, statusRow, existing, force }) {
  const allIds = source.steps.map((step) => step.step_id)
  const existingById = new Map(((existing && existing.steps) || []).map((step) => [step.step_id, step]))
  const human = allIds.filter((id) => existingById.has(id) && existingById.get(id).origin === 'human')
  const locked = force ? [] : human
  const published = Boolean(statusRow && statusRow.state === 'published' && existing)
  if (!published || force) {
    return { mode: 'full', translate: allIds.filter((id) => !locked.includes(id)), locked, finaleOutdated: true }
  }
  const wanted = new Set([...statusRow.missing_step_ids, ...statusRow.stale_step_ids])
  for (const id of allIds) if (!existingById.has(id)) wanted.add(id)
  // Статус сервера финал не учитывает: устаревший, добавленный или снятый в
  // источнике финал виден только по самому переводу (`finale.stale`).
  const finaleOutdated = source.finale
    ? !existing.finale || Boolean(existing.finale.stale)
    : Boolean(existing.finale)
  return {
    mode: 'incremental',
    translate: allIds.filter((id) => wanted.has(id) && !locked.includes(id)),
    locked,
    finaleOutdated,
  }
}

const apiStep = (step) => ({
  step_id: step.step_id,
  ...Object.fromEntries(STEP_FIELDS.map((field) => [field, step[field] || ''])),
  answer_variants: Array.isArray(step.answer_variants) ? step.answer_variants : [],
  origin: step.origin,
})

/** Принятый перевод с сервера без служебных полей (`source_hash`, `stale`). */
function existingForTask(existing) {
  if (!existing) return null
  return {
    title: existing.title,
    finale: existing.finale ? { text: existing.finale.text } : null,
    steps: existing.steps.map(apiStep),
  }
}

function buildTask({ bundle, locale, sourceLocale, plan, existing, glossary, acceptedNames, paths, notes }) {
  const source = sourceFromBundle(bundle)
  const uiLabels = collectUiLabels({ source, sourceLocale, locale })
  return {
    kind: 'quest-translation-task',
    version: 1,
    quest: { id: bundle.id, quest_id: bundle.quest_id, city: bundle.city ? bundle.city.name_canonical || bundle.city.name : '' },
    source_locale: sourceLocale,
    locale,
    mode: plan.mode,
    translate_step_ids: plan.translate,
    locked_step_ids: plan.locked,
    instructions: [
      `Прочитай ${GUIDE_PATH} и следуй ему.`,
      `Переведи квест с ${sourceLocale} на ${locale} целиком: название, финал и шаги из translate_step_ids.`,
      'Шаги вне translate_step_ids скопируй из existing без единого изменения.',
      `Запиши результат в ${relative(paths.translation)} в форме output_shape — ничего, кроме JSON.`,
      'Русский источник, код и другие файлы не меняй.',
    ],
    notes,
    output_path: relative(paths.translation),
    output_shape: TRANSLATION_SHAPE,
    glossary,
    accepted_names: acceptedNames,
    ui_labels: uiLabels,
    source,
    existing: existingForTask(existing),
  }
}

/** Задание смысловой проверки: источник и перевод рядом, плюс ответы, которые примет сервер. */
function buildReviewTask({ task, translation, paths }) {
  const translatedById = new Map(translation.steps.map((step) => [step.step_id, step]))
  return {
    kind: 'quest-translation-review-task',
    version: 1,
    quest: task.quest,
    source_locale: task.source_locale,
    locale: task.locale,
    translation_sha256: reviewDigest({ task, translation }),
    instructions: [
      `Ты независимый проверяющий: прочитай раздел «Смысловая проверка» в ${GUIDE_PATH}.`,
      'По каждому шагу реши: (1) по переведённым заданию и подсказке игрок на месте приходит к ответу из accepted_answers — у числовых шагов (range, approx) список пуст, и верное число описывает answer_rule; (2) смысл истории и задания сохранён, надписи «как на табличке» не переведены.',
      'Перевод не правь. Отказ — это ok: false и одна фраза в detail, что именно не так.',
      `Запиши вердикт в ${relative(paths.review)} в форме output_shape; translation_sha256 перенеси без изменений.`,
    ],
    output_path: relative(paths.review),
    output_shape: {
      kind: 'quest-translation-review',
      translation_sha256: '<из этого задания>',
      verdicts: [{ step_id: '<число; null — для названия и финала>', ok: true, detail: '' }],
    },
    // Подписи кнопок интерфейса на языке перевода: по ним сверяются упоминания кнопок.
    ui_labels: task.ui_labels || [],
    title: { source: task.source.title, translation: translation.title },
    finale: task.source.finale
      ? { source: task.source.finale.text, translation: translation.finale ? translation.finale.text : '' }
      : null,
    steps: task.source.steps.map((sourceStep) => {
      const step = translatedById.get(sourceStep.step_id) || {}
      return {
        step_id: sourceStep.step_id,
        slug: sourceStep.slug,
        answer_type: sourceStep.answer_type,
        source: sourceStep,
        translation: step,
        // Сервер отдаёт игроку объединение: варианты локали + варианты источника.
        accepted_answers: [...new Set([...(step.answer_variants || []), ...sourceStep.answer_variants])],
        // У range/approx вариантов нет — верное число задано правилом (задания до этого поля его не несут).
        answer_rule: sourceStep.answer_rule || '',
      }
    }),
  }
}

module.exports = {
  DEFAULT_WORK_DIR,
  GUIDE_PATH,
  QUEST_ID_PATTERN,
  ROOT,
  WIZARD_UI_LABEL_KEYS,
  apiStep,
  artifactPaths,
  buildReviewTask,
  buildTask,
  collectUiLabels,
  describeAnswerRule,
  loadGlossary,
  parseGlossary,
  planSteps,
  readJsonFile,
  relative,
  sourceFromBundle,
  writeJsonFile,
}
