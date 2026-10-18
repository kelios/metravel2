'use strict'

/**
 * scripts/lib/questSpoilerGuard.js
 * Guard утечки игрового контента квеста — один на SSG-сборку и конвейер
 * переводов (#2474).
 *
 * До #2474 guard жил только в `generate-seo-pages.js`: перевод проходил
 * `quest:translate check`, смысловое ревью и `upload --publish`, а сборка потом
 * молча оставляла пару без статической страницы (`/en/quests/188/zaslavl-rogneda`,
 * 18.10.2026: вариант ответа «Izyaslav's sign» раскрывало описание шага). Здесь
 * одна модель блока маршрута и одна сверка, которые читают оба контура.
 */

const {
  getQuestSteps,
  getQuestIntro,
  questAnswerLiterals,
  normalizeQuestText,
  questTextRevealsAnswer,
  selectQuestSafeSentences,
  buildQuestPointFacts,
  trimQuestPointTitle,
  questPointId,
} = require('../../utils/questStoryText')

/**
 * Модель блока маршрута: что именно краулер узнаёт о точках.
 *
 * `task`, `hint` и `answer_pattern` сюда не попадают ни в каком виде — модель
 * несёт только название, место, отобранные предложения и практику. `formatFact`
 * подписывает практику (часы, билет) и на сверку утечки не влияет.
 */
function buildQuestRouteDigest(bundle, formatFact) {
  return getQuestSteps(bundle)
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null
      const answerLiterals = questAnswerLiterals(step.answer_pattern)
      const title = trimQuestPointTitle(step.title, answerLiterals)
      // Место обрезаем тем же правилом, что и название. Иначе точка, у которой
      // место повторяет полное название («Памятник Тысячелетия — ангел над
      // городом» в обоих полях), вернула бы в заголовок ровно тот хвост с
      // ответом, ради которого название и обрезано.
      const location = trimQuestPointTitle(step.location, answerLiterals)
      if (!title && !location) return null
      // Место чаще повторяет объект названия, чем дополняет его: на 14 точках
      // корпуса заголовок читался заиканием («Зимний сад — Зимний сад
      // (Гомель)»). Место, содержащее название целиком, — это и есть полный
      // заголовок точки, и повторять название перед ним незачем.
      const locationCoversTitle =
        Boolean(location) && normalizeQuestText(location).startsWith(normalizeQuestText(title))
      return {
        stepId: questPointId(step, index),
        title: locationCoversTitle ? location : title || location,
        location: locationCoversTitle || location === title ? '' : location,
        sentences: selectQuestSafeSentences(step.story, answerLiterals),
        facts: buildQuestPointFacts(step.poi_info, formatFact),
      }
    })
    .filter(Boolean)
}

/**
 * Сверка готовой страницы с сырыми полями бандла.
 *
 * Задание и подсказка проверяются по ИТОГОВОМУ HTML и сырым полям бандла:
 * проверка независима от отбора, поэтому ошибка в самом фильтре ею ловится, а
 * не маскируется. Слишком короткие задания не проверяются на вхождение целиком
 * — фраза в пару слов совпала бы случайно.
 *
 * Ответ ищется в опубликованном описании точки, а не во всём HTML: у 194 точек
 * ответ числовой, и число вроде «7» неизбежно встречается в общем шаблоне
 * страницы («Маршрут: 7 точек»). Проверять там значило бы валить сборку на
 * совпадении, которое ничего не раскрывает.
 *
 * Возвращает `{ errors, warnings }`: ошибка — то, что натворил код, и она
 * останавливает сборку; предупреждение — данность контента (ответ вплетён в
 * само название объекта), и его разбирает редактор.
 */
function findQuestSpoilerLeaks(html, bundle, digest = []) {
  // #2472: inline `<span lang>` around a quoted Cyrillic sign carries no text;
  // left in, its tag name splits a published task into `span lang ru` tokens.
  const haystack = normalizeQuestText(String(html || '').replace(/<\/?span\b[^>]*>/gi, ''))
  const errors = []
  const warnings = []
  if (!haystack) return { errors, warnings }

  const intro = getQuestIntro(bundle)
  const points = [
    ...(intro && typeof intro === 'object' ? [{ point: intro, pointId: 'intro' }] : []),
    ...getQuestSteps(bundle).map((step, index) => ({ point: step, pointId: questPointId(step, index) })),
  ]
  const digestById = new Map(digest.map((point) => [point.stepId, point]))

  for (const { point, pointId } of points) {
    if (!point || typeof point !== 'object') continue

    for (const field of ['task', 'hint']) {
      const normalized = normalizeQuestText(point[field])
      if (normalized.split(' ').filter(Boolean).length < 6) continue
      if (haystack.includes(normalized)) errors.push(`${pointId}: опубликован ${field}`)
    }

    const literals = questAnswerLiterals(point.answer_pattern)
    if (!literals.length) continue
    // Ключ общий (`questPointId`), поэтому промах здесь означает ровно одно:
    // точка в блок не попала (нет ни названия, ни места) — проверять нечего.
    const published = digestById.get(pointId)
    if (!published) continue

    if (questTextRevealsAnswer(published.sentences.join(' '), literals)) {
      errors.push(`${pointId}: описание раскрывает ответ`)
    }
    if (questTextRevealsAnswer(`${published.title} ${published.location}`, literals)) {
      warnings.push(`${pointId}: ответ звучит в названии или месте точки`)
    }
  }

  return { errors, warnings }
}

/**
 * Вердикт guard'а по одному бандлу без готовой страницы — для конвейера
 * переводов, у которого нет `dist`. Сверяется всё, что страница детали берёт из
 * бандла: название квеста, вступление (`buildQuestIntroSectionModel`) и блок
 * маршрута; остальное в HTML — общий шаблон, и игрового контента в нём нет.
 */
function findQuestBundleSpoilerLeaks(bundle) {
  const digest = buildQuestRouteDigest(bundle)
  const intro = getQuestIntro(bundle)
  const published = [
    bundle && bundle.title,
    intro && intro.location,
    intro && intro.story,
    ...digest.flatMap((point) => [point.title, point.location, ...point.sentences]),
  ]
  return findQuestSpoilerLeaks(published.filter(Boolean).join('\n'), bundle, digest)
}

module.exports = {
  buildQuestRouteDigest,
  findQuestSpoilerLeaks,
  findQuestBundleSpoilerLeaks,
}
