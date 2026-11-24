// Валидатор конфига адвент-календаря (#2862) и накладок переводов (#2883). CommonJS: его читают и гейт
// `scripts/validate-advent-config.mjs`, и юнит-тест `__tests__/advent`.
//
// Проверки: 27 дверец, дни 1…27 по порядку, даты уникальны и возрастают и лежат
// в окне кампании, 24 основные дверцы идут подряд с 01.12, у загадок есть
// `answer_pattern` с непустым значением, у гео — координаты и радиус, у переходов —
// существующий маршрут приложения (первый сегмент пути есть в `app/(tabs)` или `app/`).

const fs = require('node:fs')
const path = require('node:path')

const KINDS = new Set(['content', 'site-action', 'riddle', 'geo', 'creative', 'social', 'planning'])
const TASK_TYPES = new Set(['open', 'route', 'riddle', 'geo'])
const ANSWER_TYPES = new Set(['exact', 'exact_any'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

function defaultRouteExists(rootDir) {
  const tabsDir = path.join(rootDir, 'app', '(tabs)')
  const appDir = path.join(rootDir, 'app')
  const exists = (dir, segment) =>
    fs.existsSync(path.join(dir, `${segment}.tsx`)) ||
    fs.existsSync(path.join(dir, `${segment}.web.tsx`)) ||
    fs.existsSync(path.join(dir, segment))
  return (route) => {
    const [pathname] = route.split(/[?#]/)
    const segment = pathname.replace(/^\/+/, '').split('/')[0]
    if (!segment) return true
    return exists(tabsDir, segment) || exists(appDir, segment)
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const REGIONS = new Set(['by', 'pl'])
const GAME_KINDS = new Set(['selfcheck', 'match', 'pick', 'wishlist', 'fortune'])

/** Игра дверцы (#3487): форма по виду, тексты непустые, игра решаема. */
function validateGame(game, label, routeExists, errors) {
  if (!game || typeof game !== 'object') {
    errors.push(`${label}: task.game должен быть объектом`)
    return
  }
  if (!GAME_KINDS.has(game.kind)) {
    errors.push(`${label}: неизвестный task.game.kind ${JSON.stringify(game.kind)}`)
    return
  }
  const list = (value) => (Array.isArray(value) ? value : [])
  if (game.kind === 'selfcheck') {
    const items = list(game.items)
    if (items.length < 3 || !items.every(isNonEmptyString)) errors.push(`${label}: selfcheck.items — минимум три непустые карточки`)
    const tiers = list(game.tiers)
    if (tiers.length < 2) errors.push(`${label}: selfcheck.tiers — минимум два звания`)
    if (!tiers.some((tier) => tier && tier.min === 0)) errors.push(`${label}: selfcheck.tiers — нужно звание с min 0, чтобы итог был у любого`)
    tiers.forEach((tier, index) => {
      const tLabel = `${label} tiers[${index}]`
      if (!tier || !Number.isInteger(tier.min) || tier.min < 0 || tier.min > items.length) errors.push(`${tLabel}: min — целое от 0 до ${items.length}`)
      if (!tier || !isNonEmptyString(tier.title) || !isNonEmptyString(tier.text)) errors.push(`${tLabel}: title и text обязательны`)
      if (tier && tier.link !== undefined && (!isNonEmptyString(tier.link) || !tier.link.startsWith('/') || !routeExists(tier.link))) {
        errors.push(`${tLabel}: link ${JSON.stringify(tier.link)} не ведёт на маршрут приложения`)
      }
    })
    if (new Set(tiers.map((tier) => tier && tier.min)).size !== tiers.length) errors.push(`${label}: selfcheck.tiers — пороги min повторяются`)
  }
  if (game.kind === 'match') {
    const pairs = list(game.pairs)
    if (pairs.length < 3) errors.push(`${label}: match.pairs — минимум три пары`)
    pairs.forEach((pair, index) => {
      if (!pair || !isNonEmptyString(pair.left) || !isNonEmptyString(pair.right)) errors.push(`${label} pairs[${index}]: left и right обязательны`)
    })
    const rights = pairs.map((pair) => pair && String(pair.right).trim().toLowerCase())
    if (new Set(rights).size !== rights.length) errors.push(`${label}: match.pairs — правые карточки повторяются, пара неоднозначна`)
  }
  if (game.kind === 'pick') {
    const items = list(game.items)
    if (items.length < 4) errors.push(`${label}: pick.items — минимум четыре вещи`)
    items.forEach((item, index) => {
      if (!item || !isNonEmptyString(item.label) || typeof item.correct !== 'boolean') errors.push(`${label} items[${index}]: label и correct обязательны`)
    })
    if (!items.some((item) => item && item.correct) || !items.some((item) => item && item.correct === false)) {
      errors.push(`${label}: pick.items — нужны и верные, и лишние вещи`)
    }
  }
  if (game.kind === 'fortune') {
    const items = list(game.items)
    if (items.length < 10 || !items.every(isNonEmptyString)) errors.push(`${label}: fortune.items — минимум десять непустых предсказаний`)
    if (new Set(items.map((item) => String(item).trim())).size !== items.length) errors.push(`${label}: fortune.items — предсказания повторяются`)
  }
  if (game.kind === 'wishlist') {
    const places = list(game.places)
    if (!Number.isInteger(game.goal) || game.goal < 1) errors.push(`${label}: wishlist.goal — положительное целое`)
    else if (places.length < game.goal) errors.push(`${label}: wishlist.places меньше цели ${game.goal}`)
    const ids = new Set()
    places.forEach((item, index) => {
      const pLabel = `${label} places[${index}]`
      if (!item || !Number.isInteger(item.travelId) || item.travelId < 1) errors.push(`${pLabel}: travelId — положительное целое`)
      else if (ids.has(item.travelId)) errors.push(`${pLabel}: travelId ${item.travelId} повторяется`)
      else ids.add(item.travelId)
      if (!item || !isNonEmptyString(item.title)) errors.push(`${pLabel}: title пуст`)
      if (!item || !isNonEmptyString(item.link) || !item.link.startsWith('/') || !routeExists(item.link)) errors.push(`${pLabel}: link не ведёт на маршрут приложения`)
      if (item && item.image !== undefined && !/^https:\/\//.test(String(item.image))) errors.push(`${pLabel}: image должен быть https-URL`)
    })
  }
}

/** Как `adventTaskCreditsOnOpen`: `open` без игры засчитывается самим открытием. */
const creditsOnOpen = (task) => !!task && task.type === 'open' && !(task.game && GAME_KINDS.has(task.game.kind))

/** Подарок и задание — основные или варианта (#3486): одни правила для обоих. */
function validateDoorContent(gift, task, label, routeExists, errors) {
  gift = gift || {}
  if (!isNonEmptyString(gift.title)) errors.push(`${label}: gift.title пуст`)
  if (!isNonEmptyString(gift.text)) errors.push(`${label}: gift.text пуст`)
  if (gift.link !== undefined) {
    if (!isNonEmptyString(gift.link)) errors.push(`${label}: gift.link пуст`)
    else if (gift.link.startsWith('/') && !routeExists(gift.link)) errors.push(`${label}: gift.link ${gift.link} не ведёт на маршрут приложения`)
    else if (!gift.link.startsWith('/') && !/^https:\/\//.test(gift.link)) errors.push(`${label}: gift.link должен быть внутренним путём или https-URL`)
  }

  task = task || {}
  if (!TASK_TYPES.has(task.type)) errors.push(`${label}: неизвестный task.type ${JSON.stringify(task.type)}`)
  if (!isNonEmptyString(task.text)) errors.push(`${label}: task.text пуст`)
  if (task.type === 'route') {
    if (!isNonEmptyString(task.ctaRoute) || !task.ctaRoute.startsWith('/')) errors.push(`${label}: task.ctaRoute обязателен для type=route и должен начинаться с «/»`)
    else if (!routeExists(task.ctaRoute)) errors.push(`${label}: task.ctaRoute ${task.ctaRoute} не ведёт на маршрут приложения`)
  }
  if (task.type === 'riddle') {
    const questions = task.riddle && Array.isArray(task.riddle.questions) ? task.riddle.questions : []
    if (questions.length === 0) errors.push(`${label}: у загадки нет riddle.questions`)
    questions.forEach((question, qIndex) => {
      const qLabel = `${label} question[${qIndex}]`
      if (!isNonEmptyString(question.question)) errors.push(`${qLabel}: текст вопроса пуст`)
      const pattern = question.answer_pattern
      if (!pattern || !ANSWER_TYPES.has(pattern.type)) errors.push(`${qLabel}: answer_pattern.type должен быть exact или exact_any`)
      else if (pattern.type === 'exact' && !isNonEmptyString(pattern.value)) errors.push(`${qLabel}: answer_pattern.value пуст`)
      else if (pattern.type === 'exact_any' && (!Array.isArray(pattern.value) || pattern.value.length === 0 || !pattern.value.every(isNonEmptyString))) {
        errors.push(`${qLabel}: answer_pattern.value для exact_any — непустой массив строк`)
      }
      if (question.options !== undefined && (!Array.isArray(question.options) || question.options.length < 2)) {
        errors.push(`${qLabel}: options — минимум два варианта`)
      } else if (Array.isArray(question.options) && pattern && ANSWER_TYPES.has(pattern.type)) {
        // Викторина с вариантами обязана быть решаемой: один из вариантов совпадает с ответом.
        const answers = (Array.isArray(pattern.value) ? pattern.value : [pattern.value]).map((value) => String(value).trim().toLowerCase())
        if (!question.options.some((option) => answers.includes(String(option).trim().toLowerCase()))) {
          errors.push(`${qLabel}: ни один из options не совпадает с answer_pattern`)
        }
      }
    })
  }
  if (task.type === 'geo') {
    const geo = task.geo
    if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') errors.push(`${label}: geo.lat/geo.lng обязательны`)
    else if (Math.abs(geo.lat) > 90 || Math.abs(geo.lng) > 180) errors.push(`${label}: geo координаты вне диапазона`)
    if (!geo || !(geo.radiusMeters > 0)) errors.push(`${label}: geo.radiusMeters должен быть > 0`)
  }
  if (task.game !== undefined) validateGame(task.game, label, routeExists, errors)
}

/** Варианты дверцы (#3486): регион основного задания, по одному варианту на другой регион. */
function validateDoorVariants(door, label, routeExists, errors) {
  if (door.variants === undefined) {
    if (door.region !== undefined) errors.push(`${label}: region без variants не нужен`)
    return
  }
  if (!Array.isArray(door.variants) || door.variants.length === 0) {
    errors.push(`${label}: variants — непустой массив`)
    return
  }
  if (!REGIONS.has(door.region)) errors.push(`${label}: у дверцы с variants нужен region by или pl`)
  const seen = new Set([door.region])
  door.variants.forEach((variant, index) => {
    const vLabel = `${label} variants[${index}]`
    if (!variant || !REGIONS.has(variant.region)) {
      errors.push(`${vLabel}: region должен быть by или pl`)
      return
    }
    if (seen.has(variant.region)) errors.push(`${vLabel}: регион ${variant.region} уже занят`)
    seen.add(variant.region)
    validateDoorContent(variant.gift, variant.task, vLabel, routeExists, errors)
    if (variant.task && variant.task.serverCredited !== undefined) errors.push(`${vLabel}: serverCredited задаёт правило дверцы, а не вариант`)
    // Зачёт открытием решает экран по основному заданию (AdventScreen, админ-превью):
    // вариант с другим правилом засчитался бы до игры или не засчитался бы никогда.
    if (variant.task && creditsOnOpen(variant.task) !== creditsOnOpen(door.task)) {
      errors.push(`${vLabel}: зачёт открытием (type open без игры) должен совпадать с основным заданием`)
    }
  })
}

/**
 * @param {unknown} config
 * @param {{ routeExists?: (route: string) => boolean, expectedDoors?: number, mainDoors?: number }} [options]
 * @returns {string[]} список ошибок; пустой — конфиг валиден
 */
function validateAdventConfig(config, options = {}) {
  const errors = []
  const routeExists = options.routeExists || (() => true)
  const expectedDoors = options.expectedDoors ?? 27
  const mainDoors = options.mainDoors ?? 24

  if (!config || typeof config !== 'object') return ['config: ожидался объект']
  const { year, start, end, doors } = config
  if (!Number.isInteger(year)) errors.push('year: ожидалось целое число')
  if (!ISO_DATE.test(String(start))) errors.push(`start: ожидалась дата YYYY-MM-DD, получено ${JSON.stringify(start)}`)
  if (!ISO_DATE.test(String(end))) errors.push(`end: ожидалась дата YYYY-MM-DD, получено ${JSON.stringify(end)}`)
  if (!Array.isArray(doors)) return [...errors, 'doors: ожидался массив']
  if (doors.length !== expectedDoors) errors.push(`doors: ожидалось ${expectedDoors} дверец, получено ${doors.length}`)

  const seenDates = new Set()
  let previousDate = ''
  doors.forEach((door, index) => {
    const label = `doors[${index}] (day ${door && door.day})`
    if (!door || typeof door !== 'object') {
      errors.push(`${label}: ожидался объект`)
      return
    }
    if (door.day !== index + 1) errors.push(`${label}: day должен быть ${index + 1}`)
    if (!ISO_DATE.test(String(door.date))) errors.push(`${label}: date должна быть YYYY-MM-DD`)
    else {
      if (seenDates.has(door.date)) errors.push(`${label}: дата ${door.date} повторяется`)
      seenDates.add(door.date)
      if (door.date <= previousDate) errors.push(`${label}: дата ${door.date} не позже предыдущей ${previousDate}`)
      previousDate = door.date
      if (ISO_DATE.test(String(start)) && door.date < start) errors.push(`${label}: дата ${door.date} раньше начала кампании ${start}`)
      if (ISO_DATE.test(String(end)) && door.date > end) errors.push(`${label}: дата ${door.date} позже конца кампании ${end}`)
      const isMain = index < mainDoors
      if (isMain && door.bonus) errors.push(`${label}: основная дверца не может быть bonus`)
      if (!isMain && !door.bonus) errors.push(`${label}: дверца после ${mainDoors}-й должна быть bonus`)
      if (door.secret && !door.bonus) errors.push(`${label}: secret допустим только у bonus-дверцы`)
      if (isMain && ISO_DATE.test(String(start)) && door.date !== addDays(start, index)) {
        errors.push(`${label}: основная дверца должна открываться ${addDays(start, index)}, а не ${door.date}`)
      }
    }
    if (!KINDS.has(door.kind)) errors.push(`${label}: неизвестный kind ${JSON.stringify(door.kind)}`)

    validateDoorContent(door.gift, door.task, label, routeExists, errors)
    validateDoorVariants(door, label, routeExists, errors)

    const reward = door.reward || {}
    if (!Number.isInteger(reward.xp) || reward.xp <= 0) errors.push(`${label}: reward.xp — положительное целое`)
  })

  return errors
}


const OVERLAY_FORBIDDEN_KEYS = ['correct', 'travelId', 'min', 'goal', 'region', 'link', 'ctaRoute', 'date', 'kind', 'answer_pattern', 'geo', 'xp', 'badgeSlug', 'bonus', 'secret', 'image', 'type', 'day']
const SUPPORTED_OVERLAY_LOCALES = new Set(['be', 'uk', 'pl', 'en'])

const findForbiddenKeys = (value, pathLabel, errors) => {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (OVERLAY_FORBIDDEN_KEYS.includes(key)) errors.push(`${pathLabel}.${key}: поле не переводится — живёт в RU-конфиге`)
    else findForbiddenKeys(child, `${pathLabel}.${key}`, errors)
  }
}

const normalizeAnswer = (value) => String(value).trim().toLowerCase()

/** Перевод подарка и задания (основных или варианта): тексты, вопросы, игра. */
function validateOverlayContent(gift, task, patchGift, patchTask, label, errors) {
  const expectText = (value, fieldLabel) => {
    if (!isNonEmptyString(value)) errors.push(`${label}.${fieldLabel}: перевод пуст`)
  }
  expectText(patchGift && patchGift.title, 'gift.title')
  expectText(patchGift && patchGift.text, 'gift.text')
  if (gift && gift.linkLabel !== undefined) expectText(patchGift && patchGift.linkLabel, 'gift.linkLabel')
  expectText(patchTask && patchTask.text, 'task.text')
  if (task && task.ctaLabel !== undefined) expectText(patchTask && patchTask.ctaLabel, 'task.ctaLabel')

  const sourceQuestions = task && task.riddle && Array.isArray(task.riddle.questions) ? task.riddle.questions : []
  if (sourceQuestions.length) {
    const translated = patchTask && patchTask.riddle && Array.isArray(patchTask.riddle.questions) ? patchTask.riddle.questions : null
    if (!translated || translated.length !== sourceQuestions.length) {
      errors.push(`${label}.task.riddle.questions: ожидалось ${sourceQuestions.length} вопросов`)
    } else {
      sourceQuestions.forEach((question, index) => {
        const qLabel = `${label}.task.riddle.questions[${index}]`
        const patchQuestion = translated[index] || {}
        expectText(patchQuestion.question, `task.riddle.questions[${index}].question`)
        if (question.hint !== undefined) expectText(patchQuestion.hint, `task.riddle.questions[${index}].hint`)
        if (Array.isArray(question.options)) {
          const options = patchQuestion.options
          if (!Array.isArray(options) || options.length !== question.options.length || !options.every(isNonEmptyString)) {
            errors.push(`${qLabel}.options: ожидалось ${question.options.length} непустых вариантов в том же порядке`)
            return
          }
          const pattern = question.answer_pattern || {}
          const answers = (Array.isArray(pattern.value) ? pattern.value : [pattern.value]).map(normalizeAnswer)
          const ruCorrect = question.options.findIndex((option) => answers.includes(normalizeAnswer(option)))
          if (ruCorrect >= 0 && !answers.includes(normalizeAnswer(options[ruCorrect]))) {
            errors.push(`${qLabel}.options[${ruCorrect}] ${JSON.stringify(options[ruCorrect])}: верный вариант этого языка не входит в answer_pattern RU-конфига`)
          }
        } else if (patchQuestion.options !== undefined) {
          errors.push(`${qLabel}.options: у свободной загадки вариантов нет`)
        }
      })
    }
  } else if (patchTask && patchTask.riddle !== undefined) {
    errors.push(`${label}.task.riddle: у дверцы без загадки перевода вопросов быть не должно`)
  }

  const game = task && task.game
  const patchGame = patchTask && patchTask.game
  if (!game) {
    if (patchGame !== undefined) errors.push(`${label}.task.game: у задания без игры перевода игры быть не должно`)
    return
  }
  const sameLength = (source, translated, field) => {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      errors.push(`${label}.task.game.${field}: ожидалось ${source.length} элементов в том же порядке`)
      return false
    }
    return true
  }
  if (game.kind === 'selfcheck') {
    if (sameLength(game.items, patchGame && patchGame.items, 'items')) {
      patchGame.items.forEach((item, index) => expectText(item, `task.game.items[${index}]`))
    }
    if (sameLength(game.tiers, patchGame && patchGame.tiers, 'tiers')) {
      game.tiers.forEach((tier, index) => {
        const translated = patchGame.tiers[index] || {}
        expectText(translated.title, `task.game.tiers[${index}].title`)
        expectText(translated.text, `task.game.tiers[${index}].text`)
        if (tier.linkLabel !== undefined) expectText(translated.linkLabel, `task.game.tiers[${index}].linkLabel`)
      })
    }
  }
  if (game.kind === 'fortune' && sameLength(game.items, patchGame && patchGame.items, 'items')) {
    patchGame.items.forEach((item, index) => expectText(item, `task.game.items[${index}]`))
  }
  if (game.kind === 'match' && sameLength(game.pairs, patchGame && patchGame.pairs, 'pairs')) {
    const rights = new Set()
    game.pairs.forEach((pair, index) => {
      const translated = patchGame.pairs[index] || {}
      expectText(translated.left, `task.game.pairs[${index}].left`)
      expectText(translated.right, `task.game.pairs[${index}].right`)
      if (pair.fact !== undefined) expectText(translated.fact, `task.game.pairs[${index}].fact`)
      const key = normalizeAnswer(translated.right || '')
      if (rights.has(key)) errors.push(`${label}.task.game.pairs[${index}].right: перевод повторяет другую правую карточку`)
      rights.add(key)
    })
  }
  if (game.kind === 'pick' && sameLength(game.items, patchGame && patchGame.items, 'items')) {
    game.items.forEach((item, index) => {
      const translated = patchGame.items[index] || {}
      expectText(translated.label, `task.game.items[${index}].label`)
      if (item.hint !== undefined) expectText(translated.hint, `task.game.items[${index}].hint`)
    })
  }
  if (game.kind === 'wishlist' && sameLength(game.places, patchGame && patchGame.places, 'places')) {
    patchGame.places.forEach((place, index) => expectText(place && place.title, `task.game.places[${index}].title`))
  }
}

/**
 * Накладка переводов (#2883): полный перевод каждой дверцы RU-конфига — текстовые
 * поля непустые, число вопросов и вариантов совпадает, варианты викторин входят в
 * `answer_pattern` RU-источника (иначе ответ на этом языке не засчитается),
 * непереводимые поля отсутствуют.
 * @param {unknown} overlay
 * @param {unknown} config валидный RU-конфиг
 * @param {{ locale?: string }} [options] ожидаемая локаль (из имени файла)
 * @returns {string[]}
 */
function validateAdventOverlay(overlay, config, options = {}) {
  const errors = []
  if (!overlay || typeof overlay !== 'object') return ['overlay: ожидался объект']
  if (!config || typeof config !== 'object' || !Array.isArray(config.doors)) return ['overlay: нужен валидный RU-конфиг для сверки']
  const { locale, year, doors } = overlay
  if (!SUPPORTED_OVERLAY_LOCALES.has(locale)) errors.push(`locale: ожидалась одна из ${[...SUPPORTED_OVERLAY_LOCALES].join(', ')}, получено ${JSON.stringify(locale)}`)
  if (options.locale && locale !== options.locale) errors.push(`locale: в файле ${JSON.stringify(locale)}, по имени файла ожидалась ${options.locale}`)
  if (year !== config.year) errors.push(`year: ожидалось ${config.year}, получено ${JSON.stringify(year)}`)
  if (!doors || typeof doors !== 'object' || Array.isArray(doors)) return [...errors, 'doors: ожидался объект day → перевод']

  const knownDays = new Set(config.doors.map((door) => String(door.day)))
  for (const key of Object.keys(doors)) {
    if (!knownDays.has(key)) errors.push(`doors[${key}]: такой дверцы нет в RU-конфиге`)
  }

  config.doors.forEach((door) => {
    const label = `doors[${door.day}]`
    const patch = doors[String(door.day)]
    if (!patch || typeof patch !== 'object') {
      errors.push(`${label}: перевод отсутствует`)
      return
    }
    findForbiddenKeys(patch, label, errors)
    validateOverlayContent(door.gift, door.task, patch.gift, patch.task, label, errors)
    if (door.reward && door.reward.label !== undefined && !isNonEmptyString(patch.reward && patch.reward.label)) {
      errors.push(`${label}.reward.label: перевод пуст`)
    }
    const variants = Array.isArray(door.variants) ? door.variants : []
    const patchVariants = patch.variants && typeof patch.variants === 'object' ? patch.variants : {}
    for (const key of Object.keys(patchVariants)) {
      if (!variants.some((variant) => variant.region === key)) errors.push(`${label}.variants.${key}: такого варианта нет в RU-конфиге`)
    }
    variants.forEach((variant) => {
      const translated = patchVariants[variant.region]
      const vLabel = `${label}.variants.${variant.region}`
      if (!translated || typeof translated !== 'object') {
        errors.push(`${vLabel}: перевод варианта отсутствует`)
        return
      }
      validateOverlayContent(variant.gift, variant.task, translated.gift, translated.task, vLabel, errors)
    })
  })
  return errors
}

module.exports = { validateAdventConfig, validateAdventOverlay, defaultRouteExists, SUPPORTED_OVERLAY_LOCALES }
