// components/trips/planning/tripPlanRichText.ts
// #2070: лёгкая разметка в тексте плана поездки. Хранится обычная строка
// (#1494, #1601) — разметка разбирается только при показе, поэтому старые
// описания без неё выглядят как раньше, а новые читаются блоками. Один разбор
// на экран (`TripPlanLinkedText`) и на печать (`print/tripPlanPrintHtml`).
//
// Строки:
//   `# Раздел`, строка ЗАГЛАВНЫМИ          → заголовок раздела
//   `## День`, абзац с даты («27.09 вс …») → заголовок дня
//   `- пункт`, `• пункт`, `* пункт`         → пункт списка
//   `1. пункт`, `2) пункт`                  → пункт нумерованного списка
// Внутри строки: `**жирный**`, `*курсив*`, `_курсив_`; подпись в начале строки
// («Ночь: …», «Ужин: …») выделяется жирным сама.

export interface TripPlanInline {
  text: string
  bold: boolean
  italic: boolean
}

export type TripPlanTextLine =
  | { kind: 'section'; inlines: TripPlanInline[] }
  | { kind: 'day'; inlines: TripPlanInline[] }
  | { kind: 'bullet'; marker: string; inlines: TripPlanInline[] }
  | { kind: 'text'; inlines: TripPlanInline[] }
  | { kind: 'blank' }

const LETTER = /\p{L}/u
const LOWERCASE = /\p{Ll}/u
// «27.09», «27.09.2026», «04–11.10», «02.10–04.10» в начале строки. Месяц —
// двумя цифрами 01–12: иначе время «14.00», «10.30» и дробь «5.5 км» в начале
// абзаца становились заголовком дня.
const DAY = '(?:0?[1-9]|[12]\\d|3[01])'
const DATE = `${DAY}\\.(?:0[1-9]|1[0-2])(?:\\.(?:\\d{4}|\\d{2}))?`
const DATE_LEAD = new RegExp(`^(?:(?:${DAY}|${DATE})\\s?[–-]\\s?)?${DATE}(?=[\\s·,:]|$)`)
const BULLET = /^([-•*])\s+(.*)$/
const ORDERED = /^(\d{1,3}[.)])\s+(.*)$/
// Подпись до двоеточия с пробелом: «Ночь: », «Автобус 201: ». Начинается с
// буквы и сама двоеточий не содержит — «08:10» и «https://» подписью не станут.
const LABEL = /^(\p{L}[^:\n]{0,23}:)(\s.*)$/u
const SECTION_MAX = 60
// Буква вплотную к цифре — код брони или номер трассы («X7K2QP», «E40»), а не
// заголовок: «ДЕНЬ 1» и «ПО ДНЯМ (27.09–30.09)» так не выглядят.
const CODE = /\p{L}\p{N}|\p{N}\p{L}/u

const isCapsHeading = (line: string): boolean => {
  if (line.length > SECTION_MAX || LOWERCASE.test(line) || CODE.test(line)) return false
  const letters = [...line].filter((ch) => LETTER.test(ch)).length
  return letters >= 3
}

// Граница вокруг `*курсив*` и `_курсив_`: без неё `snake_case_name`, `2*3*4` и
// подчёркивания внутри адресов превращались бы в курсив.
const OPEN_EDGE = '(^|[\\s(«"\'—–-])'
const CLOSE_EDGE = '(?=$|[\\s).,;:!?»"\'—–-])'
const INLINE_PATTERN = new RegExp(
  [
    // Тело жирного не пересекает следующий `**`: с `[\s\S]*?` каждый
    // незакрытый `**` просматривал строку до конца — 100 тыс. знаков «**a »
    // разбирались 1,6 с (квадратичный откат).
    '\\*\\*(?=\\S)((?:[^*]|\\*(?!\\*))*?\\S)\\*\\*',
    `${OPEN_EDGE}\\*(?=[^\\s*])([^*\\n]*?[^\\s*])\\*${CLOSE_EDGE}`,
    `${OPEN_EDGE}_(?=[^\\s_])([^_\\n]*?[^\\s_])_${CLOSE_EDGE}`,
  ].join('|'),
  'gu',
)

const pushText = (out: TripPlanInline[], text: string, bold: boolean, italic: boolean) => {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.bold === bold && last.italic === italic) last.text += text
  else out.push({ text, bold, italic })
}

export const parseTripPlanInline = (text: string, bold = false, italic = false): TripPlanInline[] => {
  const out: TripPlanInline[] = []
  let cursor = 0
  INLINE_PATTERN.lastIndex = 0
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const [whole, boldBody, starEdge, starBody, underEdge, underBody] = match
    const start = match.index ?? 0
    pushText(out, text.slice(cursor, start), bold, italic)
    if (boldBody !== undefined) {
      for (const part of parseTripPlanInline(boldBody, true, italic)) pushText(out, part.text, part.bold, part.italic)
    } else {
      const edge = starBody !== undefined ? starEdge : underEdge
      const body = starBody !== undefined ? starBody : underBody
      pushText(out, edge ?? '', bold, italic)
      for (const part of parseTripPlanInline(body ?? '', bold, true)) pushText(out, part.text, part.bold, part.italic)
    }
    cursor = start + whole.length
  }
  pushText(out, text.slice(cursor), bold, italic)
  return out
}

/** Подпись «Ночь:» жирным, если автор не выделил начало строки сам. */
const withLabel = (text: string): TripPlanInline[] => {
  const label = text.startsWith('**') ? null : LABEL.exec(text)
  if (!label) return parseTripPlanInline(text)
  return [...parseTripPlanInline(label[1], true), ...parseTripPlanInline(label[2])]
}

const parseLine = (line: string, previous: TripPlanTextLine['kind'] | undefined, next: string): TripPlanTextLine => {
  if (!line) return { kind: 'blank' }
  const heading = /^(#{1,3})\s+(.*)$/.exec(line)
  if (heading) {
    return { kind: heading[1].length === 1 ? 'section' : 'day', inlines: parseTripPlanInline(heading[2]) }
  }
  const bullet = BULLET.exec(line)
  if (bullet) return { kind: 'bullet', marker: '•', inlines: withLabel(bullet[2]) }
  const ordered = ORDERED.exec(line)
  if (ordered) return { kind: 'bullet', marker: ordered[1], inlines: withLabel(ordered[2]) }
  if (isCapsHeading(line)) return { kind: 'section', inlines: parseTripPlanInline(line) }
  // Абзац с даты — заголовок дня, но только если следующая строка не тоже
  // дата: иначе это список («26.09 · отель», «27.09 · мельница»). Абзац
  // открывают начало текста, пустая строка и заголовок раздела — иначе первый
  // день сразу под «ПО ДНЯМ» оставался строкой, а следующие — заголовками.
  const opensParagraph = previous === undefined || previous === 'blank' || previous === 'section'
  if (opensParagraph && DATE_LEAD.test(line) && next && !DATE_LEAD.test(next)) {
    return { kind: 'day', inlines: parseTripPlanInline(line) }
  }
  return { kind: 'text', inlines: withLabel(line) }
}

export function parseTripPlanRichText(value: string): TripPlanTextLine[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
  const result: TripPlanTextLine[] = []
  lines.forEach((line, index) => {
    result.push(parseLine(line, result[index - 1]?.kind, lines[index + 1] ?? ''))
  })
  return result
}
