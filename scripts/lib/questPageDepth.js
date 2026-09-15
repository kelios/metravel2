/**
 * scripts/lib/questPageDepth.js
 * Сколько собственного текста несёт catalog-derived страница квестов — и хватает
 * ли его, чтобы претендовать на место в выдаче.
 *
 * Правило одно, а спрашивают его двое. `generate-seo-pages.js` спрашивает до
 * записи страницы («ставить ли `noindex, follow`»), `verify-static-quest-seo.js`
 * — после сборки («не ушла ли индексируемая страница ниже порога»). Пока мерка
 * жила только в гварде, генератор решал индексируемость своей, структурной
 * меркой («городов в стране ≥ 2»), и две мерки разошлись: 18 стран считались
 * индексируемыми при 112–270 словах прозы и нулевой собственной лексике, а
 * гвард молчал, потому что уровень держали строкой исключения (#1929).
 *
 * Поэтому измерение живёт здесь в одном экземпляре: набор, который отобрал
 * `selectIndexableQuestPages`, гвард тем же кодом пройдёт зелёным, а любое
 * изменение порога двигает обе стороны сразу.
 */

const { htmlToPlainText } = require('../../utils/seoText')

/**
 * #1930: сколько текста несёт catalog-derived страница квестов и какая его доля
 * — своя.
 *
 * Три тонких шаблона за три недели — город (#1569), деталь квеста (#1763),
 * страна (#1929) — и каждая починка учила гвард только своему уровню: «секция на
 * месте». Секция может быть на месте и держать одно предложение, поэтому
 * presence не ловил четвёртый случай.
 *
 * Правило ключуется на маркер `data-ssg-quest*`, который `generate-seo-pages.js`
 * пишет на каждый crawlable-блок под `/quests`, так что уровень, которого ещё
 * нет — регион, тема, что угодно следующее — меряется в день выпуска, а не
 * после очередного отчёта GSC.
 *
 * Считаются оба написания, которые генератор уже использует:
 * `data-ssg-quest-<level>` для страничных шаблонов и `data-ssg-quests-<level>`
 * для хаба (`data-ssg-quests-listing` на `/quests`).
 *
 * Пороги калиброваны по живому каталогу. Замер 15.09.2026, слов прозы на
 * crawlable-секцию (подписи ссылок не в счёт), все страницы каталога:
 *   quest-city    n=132  min 352  median 677  max 994   своей лексики 38,8–79,4%
 *   quest-country n=34   min 112  median 115  max 270   своей лексики ≤21,1%
 *   quest-intro   n=182  min 318  median 721  max 1226  берёт порог
 *   quests-listing     1  737                           берёт порог
 *   quest-scenario     1  493                           берёт порог
 * Город взял порог собственными заметками (#1569), страна — нет и потому ушла
 * из выдачи целиком (#1929).
 */
const MIN_QUEST_PAGE_WORDS = 300
const MIN_QUEST_PAGE_DISTINCT_RATIO = 0.3
const QUEST_PAGE_SHINGLE_SIZE = 5
const QUEST_SSG_SECTION_PATTERN = '<section[^>]*\\bdata-ssg-(quests?(?:-[a-z0-9]+)*)="true"[^>]*>'

/**
 * Тело одной `<section>` с учётом вложенных. Нежадный поиск до первой
 * `</section>` обрезал бы текст и ронял страницу, которой длины хватает.
 */
function sliceBalancedSection(html, openTagStart) {
  const source = String(html)
  const openTagEnd = source.indexOf('>', openTagStart)
  if (openTagEnd === -1) return null

  const tagRegex = /<(\/?)section\b/gi
  tagRegex.lastIndex = openTagEnd + 1
  let depth = 1
  let match
  while ((match = tagRegex.exec(source)) !== null) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return source.slice(openTagEnd + 1, match.index)
  }
  return source.slice(openTagEnd + 1)
}

/**
 * Тот же текст без подписей ссылок.
 *
 * Catalog-derived посадочная — это в основном список ссылок на другие страницы,
 * а их подписи (названия городов и квестов) уникальны по построению. Их подсчёт
 * делал `/quests/country/belarus` страницей на 755 слов при 270 словах прозы и
 * заставлял две посадочные одного шаблона выглядеть непохожими только потому,
 * что у них разные списки ссылок. Тонкой странице не хватает именно текста —
 * значит текст и меряем.
 */
function sectionProseText(sectionHtml) {
  return htmlToPlainText(String(sectionHtml || '').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' '))
}

/** Каждый catalog-derived блок страницы вместе с уровнем, к которому он относится. */
function extractQuestSsgSections(html) {
  const source = String(html || '')
  const openRegex = new RegExp(QUEST_SSG_SECTION_PATTERN, 'gi')
  const sections = []
  let match
  while ((match = openRegex.exec(source)) !== null) {
    const body = sliceBalancedSection(source, match.index)
    if (body === null) continue
    sections.push({ kind: match[1].toLowerCase(), text: sectionProseText(body) })
  }
  return sections
}

/** Заявляет ли страница `noindex` — то есть не претендует на место в выдаче. */
function questPageIsNoindex(html) {
  const match = String(html || '').match(
    /<meta[^>]*name="robots"[^>]*content="([^"]*)"[^>]*\/?>/i,
  )
  return match ? /\bnoindex\b/i.test(match[1]) : false
}

/**
 * Единственная форма, которую меряет глубина текста.
 *
 * Общая, чтобы проба не померила страницу, собранную иначе, чем меряет сборка:
 * меняется способ свернуть страницу в текст здесь — и гвард, и генератор, и их
 * тесты едут следом.
 */
function questPageFromHtml(html, routePath, precomputedSections = null) {
  const sections = precomputedSections || extractQuestSsgSections(html)
  return {
    path: routePath,
    kind: sections.length > 0 ? sections[0].kind : '',
    text: sections.map((section) => section.text).join(' '),
    noindex: questPageIsNoindex(html),
  }
}

function countWords(text) {
  const words = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  return words ? words.length : 0
}

/**
 * Формулировки страницы без того, что всегда различается — чисел и слов с
 * заглавной, где живут названия городов и стран. Остаётся сам шаблон, поэтому
 * две посадочные, отличающиеся только именем и счётчиками, сводятся к одним и
 * тем же токенам.
 */
function templateSkeleton(text) {
  return String(text || '')
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0 && !/\d/.test(token) && !/^\p{Lu}/u.test(token))
    .map((token) => token.toLowerCase())
}

function textShingles(tokens, size = QUEST_PAGE_SHINGLE_SIZE) {
  const shingles = new Set()
  for (let index = 0; index + size <= tokens.length; index += 1) {
    shingles.add(tokens.slice(index, index + size).join(' '))
  }
  return shingles
}

/**
 * Вниз, чтобы строка отказа не читалась как «only 30% ... minimum 30%»:
 * страница с 29,7% своей лексики округлилась бы вверх ровно до порога, который
 * только что не взяла, и лог спорил бы сам с собой.
 */
function formatPercent(ratio) {
  return `${Math.floor(ratio * 100)}%`
}

/**
 * Доля формулировок страницы, которых не повторяет ни одна другая страница её
 * уровня. `null`, когда сравнивать не с чем: уровень из одной страницы не может
 * быть шаблоном самого себя.
 */
function distinctShingleRatio(page, kindPageCount, shingleUses) {
  if (kindPageCount < 2 || page.shingles.size === 0) return null
  let distinct = 0
  for (const shingle of page.shingles) {
    if (shingleUses.get(shingle) === 1) distinct += 1
  }
  return distinct / page.shingles.size
}

/**
 * Страницы одного уровня, померенные против заданных порогов.
 *
 * Уникальность — величина относительная, поэтому уровень меряется целиком, а не
 * страница за страницей: одна и та же страница в наборе из одного и в наборе из
 * восемнадцати даёт разный ответ, и это не дефект, а смысл правила.
 */
function scoreQuestPageLevel(pages, options = {}) {
  const minWords = Number.isFinite(options.minWords) ? options.minWords : MIN_QUEST_PAGE_WORDS
  const minDistinctRatio = Number.isFinite(options.minDistinctRatio)
    ? options.minDistinctRatio
    : MIN_QUEST_PAGE_DISTINCT_RATIO

  const prepared = (Array.isArray(pages) ? pages : []).map((page) => {
    const text = String(page?.text || '')
    return {
      path: String(page?.path || '').trim() || '(unknown quest page)',
      kind: String(page?.kind || '').trim().toLowerCase(),
      words: countWords(text),
      shingles: textShingles(templateSkeleton(text)),
    }
  })

  const shingleUses = new Map()
  for (const page of prepared) {
    for (const shingle of page.shingles) {
      shingleUses.set(shingle, (shingleUses.get(shingle) || 0) + 1)
    }
  }

  return prepared.map((page) => {
    const ratio = distinctShingleRatio(page, prepared.length, shingleUses)
    const issues = []
    if (page.words < minWords) {
      issues.push(`${page.words} words of crawlable text, minimum ${minWords}`)
    }
    if (ratio !== null && ratio < minDistinctRatio) {
      issues.push(
        `only ${formatPercent(ratio)} of its wording is its own, minimum ${formatPercent(minDistinctRatio)}` +
          ' — reads as a shared template',
      )
    }
    return { path: page.path, kind: page.kind, words: page.words, ratio, issues }
  })
}

/** Страницы по уровням — уникальность меряется внутри уровня, а не по всему сайту. */
function groupQuestPagesByKind(pages) {
  const byKind = new Map()
  for (const page of Array.isArray(pages) ? pages : []) {
    const kind = String(page?.kind || '').trim().toLowerCase()
    if (!kind) continue
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind).push(page)
  }
  return byKind
}

/**
 * Пути страниц, чей собственный текст оплачивает место в выдаче.
 *
 * Отбор за один проход, и этого достаточно: выброшенная страница только
 * уменьшает счётчики повторов, то есть поднимает долю собственной лексики у
 * оставшихся. Страница, прошедшая на полном наборе, не может провалиться на
 * усечённом — поэтому гвард, меряющий уже только отобранные, не покраснеет на
 * наборе, который сам же отбор и построил.
 */
function selectIndexableQuestPages(pages, options = {}) {
  const indexable = new Set()
  for (const [, kindPages] of groupQuestPagesByKind(pages)) {
    for (const scored of scoreQuestPageLevel(kindPages, options)) {
      if (scored.issues.length === 0) indexable.add(scored.path)
    }
  }
  return indexable
}

module.exports = {
  MIN_QUEST_PAGE_DISTINCT_RATIO,
  MIN_QUEST_PAGE_WORDS,
  QUEST_PAGE_SHINGLE_SIZE,
  QUEST_SSG_SECTION_PATTERN,
  countWords,
  distinctShingleRatio,
  extractQuestSsgSections,
  formatPercent,
  groupQuestPagesByKind,
  questPageFromHtml,
  questPageIsNoindex,
  scoreQuestPageLevel,
  sectionProseText,
  selectIndexableQuestPages,
  sliceBalancedSection,
  templateSkeleton,
  textShingles,
}
