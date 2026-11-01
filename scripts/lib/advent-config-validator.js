// Валидатор конфига адвент-календаря (#2862). CommonJS: его читают и гейт
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

    const gift = door.gift || {}
    if (!isNonEmptyString(gift.title)) errors.push(`${label}: gift.title пуст`)
    if (!isNonEmptyString(gift.text)) errors.push(`${label}: gift.text пуст`)
    if (gift.link !== undefined) {
      if (!isNonEmptyString(gift.link)) errors.push(`${label}: gift.link пуст`)
      else if (gift.link.startsWith('/') && !routeExists(gift.link)) errors.push(`${label}: gift.link ${gift.link} не ведёт на маршрут приложения`)
      else if (!gift.link.startsWith('/') && !/^https:\/\//.test(gift.link)) errors.push(`${label}: gift.link должен быть внутренним путём или https-URL`)
    }

    const task = door.task || {}
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

    const reward = door.reward || {}
    if (!Number.isInteger(reward.xp) || reward.xp <= 0) errors.push(`${label}: reward.xp — положительное целое`)
  })

  return errors
}

module.exports = { validateAdventConfig, defaultRouteExists }
