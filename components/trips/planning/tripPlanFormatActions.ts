// components/trips/planning/tripPlanFormatActions.ts
// #2072: кнопки оформления редактора плана ставят и снимают лёгкую разметку
// #2070 (`tripPlanRichText.ts`) в обычной строке описания. Чистые функции:
// текст + выделение → новый текст + новое выделение; поле ввода применяет их
// само, формат хранения не меняется.
//
// Строки выделения: `## ` заголовок дня, `- ` пункт, `1. ` нумерованный пункт.
// Внутри строки: `**жирный**`, `_курсив_`. Повторное нажатие снимает разметку.

export type TripPlanFormatAction = 'heading' | 'bullet' | 'ordered' | 'bold' | 'italic'

export interface TripPlanTextSelection {
  start: number
  end: number
}

export interface TripPlanFormatResult {
  value: string
  selection: TripPlanTextSelection
}

type LineAction = 'heading' | 'bullet' | 'ordered'
type InlineAction = 'bold' | 'italic'

// Маркеры, которые разбирает `tripPlanRichText.ts`. Первый — тот, что ставит
// кнопка; курсив в тексте с `_` (snake_case, адрес) ставится через `*`, иначе
// тело `_…_` оборвалось бы на первом подчёркивании.
const INLINE_MARKERS: Record<InlineAction, readonly string[]> = { bold: ['**'], italic: ['_', '*'] }

// Те же префиксы, что разбирает `tripPlanRichText.ts`: `#`–`###`, `-`/`•`/`*`,
// `1.`/`1)`. `**жирный**` в начале строки пунктом не считается — после `*`
// обязателен пробел.
const LINE_PREFIX: Record<LineAction, RegExp> = {
  heading: /^#{1,3}\s+/,
  bullet: /^[-•*]\s+/,
  ordered: /^\d{1,3}[.)]\s+/,
}
const LINE_ACTIONS = Object.keys(LINE_PREFIX) as LineAction[]

// Слово под курсором: буквы, цифры и апострофы внутри слова («О’Коннор»).
const WORD_CHAR = /[\p{L}\p{N}'’]/u
// Границы курсива `_…_`/`*…*` из `tripPlanRichText.ts` (OPEN_EDGE/CLOSE_EDGE).
const OPEN_EDGE_CHAR = /[\s(«"'—–-]/
const CLOSE_EDGE_CHAR = /[\s).,;:!?»"'—–-]/
const isOpenEdge = (ch: string | undefined) => ch === undefined || OPEN_EDGE_CHAR.test(ch)
const isCloseEdge = (ch: string | undefined) => ch === undefined || CLOSE_EDGE_CHAR.test(ch)
// Тело `**…**` разбирается рекурсивно с начала и до конца, поэтому маркер жирного
// вплотную к курсиву — тоже граница: `**_кафе_**` — жирный курсив.
const isOpenEdgeAt = (value: string, index: number) =>
  isOpenEdge(value[index]) || value.slice(index - 1, index + 1) === '**'
const isCloseEdgeAt = (value: string, index: number) =>
  isCloseEdge(value[index]) || value.slice(index, index + 2) === '**'
// Курсивные пары внутри фрагмента — по тем же правилам, что у разборщика.
const ITALIC_PAIRS = [
  /(^|[\s(«"'—–-])_(?=[^\s_])([^_\n]*?[^\s_])_(?=$|[\s).,;:!?»"'—–-])/gu,
  /(^|[\s(«"'—–-])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?=$|[\s).,;:!?»"'—–-])/gu,
]
const OTHER_ACTION: Record<InlineAction, InlineAction> = { bold: 'italic', italic: 'bold' }

export const clampTripPlanSelection = (
  selection: TripPlanTextSelection,
  length: number,
): TripPlanTextSelection => {
  const start = Math.min(Math.max(0, selection.start), length)
  const end = Math.min(Math.max(start, selection.end), length)
  return { start, end }
}

// `lastIndexOf('\n', -1)` проверяет позицию 0: без явной ветки текст,
// начатый с пустой строки, отдавал маркер следующей строке.
const lineStartOf = (value: string, index: number): number =>
  index === 0 ? 0 : value.lastIndexOf('\n', index - 1) + 1

const matchLinePrefix = (body: string): { kind: LineAction; prefix: string } | null => {
  for (const kind of LINE_ACTIONS) {
    const prefix = LINE_PREFIX[kind].exec(body)?.[0]
    if (prefix) return { kind, prefix }
  }
  return null
}

interface ParsedLine {
  indent: string
  kind: LineAction | null
  prefix: string
  content: string
}

const parseLine = (line: string): ParsedLine => {
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const body = line.slice(indent.length)
  const match = matchLinePrefix(body)
  return match
    ? { indent, kind: match.kind, prefix: match.prefix, content: body.slice(match.prefix.length) }
    : { indent, kind: null, prefix: '', content: body }
}

const linePrefixFor = (action: LineAction, ordinal: number): string =>
  action === 'heading' ? '## ' : action === 'bullet' ? '- ' : `${ordinal}. `

function applyLineFormat(value: string, selection: TripPlanTextSelection, action: LineAction): TripPlanFormatResult {
  const { start, end } = selection
  const blockStart = lineStartOf(value, start)
  // Выделение, которое кончается сразу после перевода строки, следующую строку
  // не захватывает: так выделяют «три строки» мышью и тройным кликом.
  const endAnchor = end > start && value[end - 1] === '\n' ? end - 1 : end
  const blockEndIndex = value.indexOf('\n', Math.max(endAnchor, blockStart))
  const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex

  const lines = value.slice(blockStart, blockEnd).split('\n').map(parseLine)
  const isTarget = (line: ParsedLine) => line.kind !== null || line.content.trim().length > 0
  // Пустая строка под курсором тоже получает маркер: так начинают новый список.
  const targets = lines.some(isTarget) ? lines.filter(isTarget) : lines
  const removing = targets.every((line) => line.kind === action)

  let ordinal = 0
  const nextLines = lines.map((line) => {
    if (!targets.includes(line)) return line
    if (removing) return { ...line, kind: null, prefix: '' }
    ordinal += 1
    return { ...line, kind: action, prefix: linePrefixFor(action, ordinal) }
  })
  const nextBlock = nextLines.map((line) => `${line.indent}${line.prefix}${line.content}`).join('\n')
  const nextValue = `${value.slice(0, blockStart)}${nextBlock}${value.slice(blockEnd)}`

  if (start === end) {
    // Курсор остаётся на том же месте текста строки; из старого маркера — в начало текста.
    const before = lines[0]
    const after = nextLines[0]
    const contentStart = before.indent.length + before.prefix.length
    const offset = Math.max(0, start - blockStart - contentStart)
    const cursor = blockStart + after.indent.length + after.prefix.length + offset
    return { value: nextValue, selection: { start: cursor, end: cursor } }
  }
  return { value: nextValue, selection: { start: blockStart, end: blockStart + nextBlock.length } }
}

/**
 * Слово под курсором. Курсив по границам слова: если слово прилегает к `_`,
 * букве или `/` (snake_case, адрес), берётся весь фрагмент без пробелов —
 * иначе маркеры внутри слова не читаются и ломают адрес.
 */
const targetAt = (value: string, index: number, action: InlineAction): TripPlanTextSelection | null => {
  let start = index
  let end = index
  while (start > 0 && WORD_CHAR.test(value[start - 1])) start -= 1
  while (end < value.length && WORD_CHAR.test(value[end])) end += 1
  if (end <= start) return null
  if (action === 'italic' && !(isOpenEdge(value[start - 1]) && isCloseEdge(value[end]))) {
    while (start > 0 && /\S/.test(value[start - 1])) start -= 1
    while (end < value.length && /\S/.test(value[end])) end += 1
  }
  return { start, end }
}

/** Маркер, которым обёрнут фрагмент целиком, либо `null`. */
const wrappingMarker = (core: string, action: InlineAction): string | null => {
  for (const marker of INLINE_MARKERS[action]) {
    const size = marker.length
    if (core.length <= size * 2 || !core.startsWith(marker) || !core.endsWith(marker)) continue
    const inner = core.slice(size, -size)
    // `**a** и **b**` — два жирных, а не один: снимать внешнюю пару нельзя.
    if (inner.includes(marker)) continue
    // `*…*` при курсиве не должен съедать половину жирного `**…**`.
    if (marker === '*' && (inner.startsWith('*') || inner.endsWith('*'))) continue
    return marker
  }
  return null
}

interface MarkerPair {
  marker: string
  openAt: number
  closeAt: number
}

/** Пара `marker` вплотную вокруг [start, end), если разборщик прочитал бы её как этот стиль. */
const pairAround = (value: string, start: number, end: number, action: InlineAction): MarkerPair | null => {
  const selected = value.slice(start, end)
  for (const marker of INLINE_MARKERS[action]) {
    const size = marker.length
    if (start < size || value.slice(start - size, start) !== marker || value.slice(end, end + size) !== marker) continue
    if (selected.includes(marker)) continue
    if (action === 'italic') {
      const beforeAt = start - size - 1
      const afterAt = end + size
      // Звёздочка жирного вплотную к `*` курсива — это `**`, а не курсив.
      if (marker === '*' && (value[beforeAt] === '*' || value[afterAt] === '*')) continue
      if (!isOpenEdgeAt(value, beforeAt) || !isCloseEdgeAt(value, afterAt)) continue
    }
    return { marker, openAt: start - size, closeAt: end }
  }
  return null
}

/**
 * Маркеры стиля вокруг выделения (так их оставляет обёртка ниже) — вплотную
 * или через один слой другого стиля: у `**_кафе_**` курсив снимается с
 * выделения «кафе», жирный — тоже, не трогая курсив.
 */
const surroundingPair = (value: string, start: number, end: number, action: InlineAction): MarkerPair | null => {
  const direct = pairAround(value, start, end, action)
  if (direct) return direct
  for (const other of INLINE_MARKERS[OTHER_ACTION[action]]) {
    const size = other.length
    if (value.slice(start - size, start) !== other || value.slice(end, end + size) !== other) continue
    const outer = pairAround(value, start - size, end + size, action)
    if (outer) return outer
  }
  return null
}

interface InlineSegment {
  lead: string
  core: string
  trail: string
}

// Разметка #2070 действует в пределах строки, тело не может начинаться и
// кончаться пробелом, а маркер строки (`- `, `## `, `1. `) обязан остаться
// первым: всё это выносится за маркеры начертания.
// Обёртка поверх уже оформленного куска сливает стиль, как «сделать всё
// жирным» в обычном редакторе: внутренние пары того же стиля снимаются, иначе
// маркеры склеились бы в `****`.
const stripInnerStyle = (core: string, action: InlineAction): string =>
  action === 'bold'
    ? core.split('**').join('')
    : ITALIC_PAIRS.reduce((text, pattern) => text.replace(pattern, '$1$2'), core)

const splitSegment = (text: string, atLineStart: boolean): InlineSegment => {
  const indent = /^\s*/.exec(text)?.[0] ?? ''
  let rest = text.slice(indent.length)
  const linePrefix = atLineStart ? matchLinePrefix(rest)?.prefix ?? '' : ''
  rest = rest.slice(linePrefix.length)
  const trail = /\s*$/.exec(rest)?.[0] ?? ''
  return { lead: `${indent}${linePrefix}`, core: rest.slice(0, rest.length - trail.length), trail }
}

function applyInlineFormat(value: string, selection: TripPlanTextSelection, action: InlineAction): TripPlanFormatResult {
  let { start, end } = selection

  if (start === end) {
    const target = targetAt(value, start, action)
    if (!target) {
      // Повторное нажатие на пустой паре (передумали) снимает её. Пару ставит
      // только первый маркер стиля: `*|*` посреди `**` жирного — не пара курсива.
      const empty = INLINE_MARKERS[action][0]
      if (value.slice(start - empty.length, start + empty.length) === `${empty}${empty}`) {
        const size = empty.length
        const nextValue = `${value.slice(0, start - size)}${value.slice(start + size)}`
        return { value: nextValue, selection: { start: start - size, end: start - size } }
      }
      // Курсор между словами: пара маркеров, курсор внутри — дальше печатают.
      // В маркере строки (`- `, `## `, `1. `) пара встаёт после него, иначе
      // пункт или заголовок перестал бы им быть.
      const lineStart = lineStartOf(value, start)
      const lineEnd = value.indexOf('\n', lineStart)
      const lead = splitSegment(value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd), true).lead
      const at = Math.max(start, lineStart + lead.length)
      const marker = INLINE_MARKERS[action][0]
      const nextValue = `${value.slice(0, at)}${marker}${marker}${value.slice(at)}`
      return { value: nextValue, selection: { start: at + marker.length, end: at + marker.length } }
    }
    ;({ start, end } = target)
  }

  // Курсив внутри слова разборщик не читает (`каф_е у_ озера`): края выделения,
  // разрезающие слово, дотягиваются до его границ.
  const expanded = { start, end }
  if (action === 'italic') {
    while (expanded.start > 0 && /\S/.test(value[expanded.start - 1]) && !isOpenEdgeAt(value, expanded.start - 1)) {
      expanded.start -= 1
    }
    while (expanded.end < value.length && /\S/.test(value[expanded.end]) && !isCloseEdgeAt(value, expanded.end)) {
      expanded.end += 1
    }
  }

  // Повторное нажатие: маркеры снаружи выделения — сначала вокруг выделения как
  // есть (так его возвращает обёртка), затем вокруг слова, если выделена его часть.
  if (!value.slice(start, end).includes('\n')) {
    for (const range of [{ start, end }, expanded]) {
      const around = surroundingPair(value, range.start, range.end, action)
      if (!around) continue
      const size = around.marker.length
      const nextValue = `${value.slice(0, around.openAt)}${value.slice(around.openAt + size, around.closeAt)}${value.slice(around.closeAt + size)}`
      return { value: nextValue, selection: { start: range.start - size, end: range.end - size } }
    }
  }
  ;({ start, end } = expanded)

  // Выделение, захватившее только один маркер жирного (`Ужин в **кафе`),
  // дотягивается до его пары в пределах строки — иначе снятие внутренних пар
  // оставило бы непарный `**` за краем.
  if ((value.slice(start, end).split('**').length - 1) % 2 === 1) {
    const lineEnd = value.indexOf('\n', end)
    const next = value.indexOf('**', end)
    const previous = value.lastIndexOf('**', start - 2)
    if (next !== -1 && (lineEnd === -1 || next < lineEnd)) end = next + 2
    else if (previous !== -1 && previous >= lineStartOf(value, start)) start = previous
  }

  const firstAtLineStart = start === lineStartOf(value, start)
  const segments = value
    .slice(start, end)
    .split('\n')
    .map((text, index) => splitSegment(text, index > 0 || firstAtLineStart))
  const filled = segments.filter((segment) => segment.core)
  // Снимаем, только если обёрнута каждая непустая строка — иначе дооформляем.
  const unwrapping = filled.length > 0 && filled.every((segment) => wrappingMarker(segment.core, action))

  const nextSegments = segments.map((segment, index) => {
    if (!segment.core) return { ...segment, text: `${segment.lead}${segment.trail}`, innerStart: 0, inner: '' }
    if (unwrapping) {
      const size = (wrappingMarker(segment.core, action) as string).length
      const inner = segment.core.slice(size, -size)
      return { ...segment, text: `${segment.lead}${inner}${segment.trail}`, innerStart: segment.lead.length, inner }
    }
    const core = stripInnerStyle(segment.core, action)
    const marker = action === 'italic' && core.includes('_') ? '*' : INLINE_MARKERS[action][0]
    // `*` курсива вплотную к `**` жирного даёт `***…***`, которое разборщик #2070
    // не читает: такое сочетание (жирный курсив текста с `_`) не ставим.
    const before = segment.lead ? segment.lead.slice(-1) : index === 0 ? value[start - 1] ?? '' : ''
    const after = segment.trail ? segment.trail[0] : index === segments.length - 1 ? value[end] ?? '' : ''
    if ((marker === '*' || action === 'bold') && /^\*|\*$/.test(`${before}${core}${after}`)) {
      return { ...segment, text: `${segment.lead}${segment.core}${segment.trail}`, innerStart: segment.lead.length, inner: segment.core }
    }
    return {
      ...segment,
      text: `${segment.lead}${marker}${core}${marker}${segment.trail}`,
      innerStart: segment.lead.length + marker.length,
      inner: core,
    }
  })
  const block = nextSegments.map((segment) => segment.text).join('\n')
  const nextValue = `${value.slice(0, start)}${block}${value.slice(end)}`
  if (nextSegments.length === 1 && nextSegments[0].inner) {
    const innerStart = start + nextSegments[0].innerStart
    return { value: nextValue, selection: { start: innerStart, end: innerStart + nextSegments[0].inner.length } }
  }
  return { value: nextValue, selection: { start, end: start + block.length } }
}

/** Ставит или снимает разметку `action` у выделения `selection` в `value`. */
export function applyTripPlanFormat(
  value: string,
  selection: TripPlanTextSelection,
  action: TripPlanFormatAction,
): TripPlanFormatResult {
  const safe = clampTripPlanSelection(selection, value.length)
  return action === 'bold' || action === 'italic'
    ? applyInlineFormat(value, safe, action)
    : applyLineFormat(value, safe, action)
}
