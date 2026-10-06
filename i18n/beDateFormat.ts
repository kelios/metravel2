/**
 * Белорусские даты там, где у движка нет данных `be` (#2283).
 *
 * Chromium (замер 06.10.2026, версия 149) не знает `be` в `Intl.DateTimeFormat`
 * и молча форматирует локалью хоста. RU-формат здесь не годится: другие названия
 * месяцев и дней, другие шаблоны («12 вер 2026», «2, серада», «у 09:05»). Модуль
 * несёт CLDR-данные `be` (выгрузка из ICU 76.1 / CLDR 46 в Node 22) и шаблоны
 * для тех наборов опций, что умеет описать; на остальное отвечает `null`, и
 * `i18n/format.ts` берёт осознанный фолбэк RU, а не язык системы.
 * Паритет с полным ICU держит `__tests__/i18n/formatLocaleContract.test.ts`.
 */

const MONTHS_FORMAT_LONG = [
  'студзеня', 'лютага', 'сакавіка', 'красавіка', 'мая', 'чэрвеня',
  'ліпеня', 'жніўня', 'верасня', 'кастрычніка', 'лістапада', 'снежня',
]
const MONTHS_STANDALONE_LONG = [
  'студзень', 'люты', 'сакавік', 'красавік', 'май', 'чэрвень',
  'ліпень', 'жнівень', 'верасень', 'кастрычнік', 'лістапад', 'снежань',
]
const MONTHS_FORMAT_SHORT = [
  'сту', 'лют', 'сак', 'кра', 'мая', 'чэр', 'ліп', 'жні', 'вер', 'кас', 'ліс', 'сне',
]
const MONTHS_STANDALONE_SHORT = [
  'сту', 'лют', 'сак', 'кра', 'май', 'чэр', 'ліп', 'жні', 'вер', 'кас', 'ліс', 'сне',
]
const MONTHS_NARROW = ['с', 'л', 'с', 'к', 'м', 'ч', 'л', 'ж', 'в', 'к', 'л', 'с']
const WEEKDAYS = {
  long: ['нядзеля', 'панядзелак', 'аўторак', 'серада', 'чацвер', 'пятніца', 'субота'],
  short: ['нд', 'пн', 'аў', 'ср', 'чц', 'пт', 'сб'],
  narrow: ['н', 'п', 'а', 'с', 'ч', 'п', 'с'],
} as const
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Опции, которые не меняют вид строки либо понятны этому модулю. */
const NEUTRAL_OPTION_KEYS = new Set(['localeMatcher', 'formatMatcher', 'timeZone'])
const FIELD_OPTION_KEYS = new Set(['weekday', 'year', 'month', 'day', 'hour', 'minute', 'second'])
const STYLE_OPTION_KEYS = new Set(['dateStyle', 'timeStyle'])

type Fields = {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>()

const readFields = (date: Date, timeZone: string | undefined): Fields => {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      weekday: date.getDay(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }
  if (/^(etc\/)?(utc|gmt)$/i.test(timeZone)) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      weekday: date.getUTCDay(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    }
  }
  // Произвольный пояс: числовые поля берутся у en-US — эта локаль есть в любом
  // ICU, а нужны от неё только цифры и индекс дня недели.
  let formatter = zonedPartsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    zonedPartsFormatters.set(timeZone, formatter)
  }
  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    weekday: EN_WEEKDAYS.indexOf(parts.weekday),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

const formatStyles = (
  fields: Fields,
  dateStyle: Intl.DateTimeFormatOptions['dateStyle'],
  timeStyle: Intl.DateTimeFormatOptions['timeStyle'],
): string | null => {
  const { year, month, day, weekday, hour, minute, second } = fields
  let datePart = ''
  if (dateStyle === 'full') {
    datePart = `${WEEKDAYS.long[weekday]}, ${day} ${MONTHS_FORMAT_LONG[month]} ${year} г.`
  } else if (dateStyle === 'long') {
    datePart = `${day} ${MONTHS_FORMAT_LONG[month]} ${year} г.`
  } else if (dateStyle === 'medium') {
    datePart = `${day} ${MONTHS_FORMAT_SHORT[month]} ${year} г.`
  } else if (dateStyle === 'short') {
    datePart = `${day}.${pad2(month + 1)}.${pad2(year % 100)}`
  } else if (dateStyle !== undefined) {
    return null
  }

  let timePart = ''
  if (timeStyle === 'short') {
    timePart = `${pad2(hour)}:${pad2(minute)}`
  } else if (timeStyle === 'medium') {
    timePart = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`
  } else if (timeStyle !== undefined) {
    // long/full несут имя пояса — его данных здесь нет.
    return null
  }

  if (!datePart) return timePart
  if (!timePart) return datePart
  const joiner = dateStyle === 'full' || dateStyle === 'long' ? ' у ' : ', '
  return `${datePart}${joiner}${timePart}`
}

const formatDatePart = (
  fields: Fields,
  options: Intl.DateTimeFormatOptions,
): string | null => {
  const { weekday: weekdayOption, year: yearOption, month: monthOption, day: dayOption } = options
  const dayText = dayOption === '2-digit' ? pad2(fields.day) : String(fields.day)
  const yearText = yearOption === '2-digit' ? pad2(fields.year % 100) : String(fields.year)
  const weekdayText = weekdayOption ? WEEKDAYS[weekdayOption][fields.weekday] : ''
  const withWeekday = (core: string) => (weekdayText ? `${weekdayText}, ${core}` : core)

  if (monthOption === 'long' || monthOption === 'short' || monthOption === 'narrow') {
    if (dayOption) {
      const monthText =
        monthOption === 'long'
          ? MONTHS_FORMAT_LONG[fields.month]
          : monthOption === 'short'
            ? MONTHS_FORMAT_SHORT[fields.month]
            : MONTHS_NARROW[fields.month]
      let core = `${dayText} ${monthText}`
      if (yearOption) core += monthOption === 'long' ? ` ${yearText} г.` : ` ${yearText}`
      return withWeekday(core)
    }
    const monthText =
      monthOption === 'long'
        ? MONTHS_STANDALONE_LONG[fields.month]
        : monthOption === 'short'
          ? MONTHS_STANDALONE_SHORT[fields.month]
          : MONTHS_NARROW[fields.month]
    if (weekdayText) return null
    return yearOption ? `${monthText} ${yearText}` : monthText
  }

  if (monthOption === 'numeric' || monthOption === '2-digit') {
    const monthText = monthOption === '2-digit' ? pad2(fields.month + 1) : String(fields.month + 1)
    const segments = [dayOption ? dayText : '', monthText, yearOption ? yearText : '']
    return withWeekday(segments.filter(Boolean).join('.'))
  }

  if (dayOption && weekdayText && !yearOption) return `${dayText}, ${weekdayText}`
  if (dayOption && !weekdayText && !yearOption) return dayText
  if (weekdayText && !dayOption && !yearOption) return weekdayText
  if (yearOption && !dayOption && !weekdayText) return yearText
  return null
}

const formatTimePart = (
  fields: Fields,
  options: Intl.DateTimeFormatOptions,
): string | null => {
  if (options.hour === undefined) return null
  const hourText = options.hour === '2-digit' ? pad2(fields.hour) : String(fields.hour)
  if (options.minute === undefined) return options.second === undefined ? hourText : null
  const base = `${hourText}:${pad2(fields.minute)}`
  return options.second === undefined ? base : `${base}:${pad2(fields.second)}`
}

/**
 * Белорусская строка даты или `null`, если набор опций этому модулю не по
 * силам (12-часовой формат, эра, имя пояса, другие календари и т. п.).
 */
export const formatBelarusianDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string | null => {
  let hasFields = false
  let hasStyles = false
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || NEUTRAL_OPTION_KEYS.has(key)) continue
    if (key === 'hour12' && value === false) continue
    if (key === 'hourCycle' && (value === 'h23' || value === 'h24')) continue
    if (FIELD_OPTION_KEYS.has(key)) hasFields = true
    else if (STYLE_OPTION_KEYS.has(key)) hasStyles = true
    else return null
  }
  // Смесь полей и стилей `Intl` отвергает исключением — пусть его и бросит.
  if (hasFields && hasStyles) return null

  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid time value')
  const fields = readFields(date, options.timeZone)

  if (hasStyles) return formatStyles(fields, options.dateStyle, options.timeStyle)

  const hasTime =
    options.hour !== undefined || options.minute !== undefined || options.second !== undefined
  const hasDate =
    options.weekday !== undefined ||
    options.year !== undefined ||
    options.month !== undefined ||
    options.day !== undefined

  if (!hasDate && !hasTime) {
    // Опции без полей — по ECMA-402 это год, месяц и день цифрами.
    return `${fields.day}.${fields.month + 1}.${fields.year}`
  }

  const datePart = hasDate ? formatDatePart(fields, options) : ''
  const timePart = hasTime ? formatTimePart(fields, options) : ''
  if (datePart === null || timePart === null) return null
  if (!datePart) return timePart
  if (!timePart) return datePart
  const joiner = options.month === 'long' && options.day !== undefined ? ' у ' : ', '
  return `${datePart}${joiner}${timePart}`
}
