/**
 * Потоковый разбор HTML-тегов по правилам токенизатора WHATWG (#3202).
 *
 * Зачем свой разборщик, а не `htmlparser2`: он нужен синхронно в островке описания
 * статьи (`TravelDescription`), то есть в eager-наборе `/travels/[param]`. Пакетный
 * `htmlparser2` там отсутствует, а прямой импорт тянул бы вторую копию парсера и
 * таблиц `entities` рядом с той, что уже живёт в ленивом чанке `sanitize-html`.
 *
 * Сущности не декодируются: значения атрибутов и текст отдаются в исходной
 * (закодированной) форме, а сериализатор экранирует только то, что может сменить
 * границы разметки. Поэтому пересборка не теряет `&nbsp;` и не экранирует дважды.
 */

export type HtmlAttribute = { name: string; value: string | null }

export type HtmlToken =
  | { kind: 'text'; start: number; end: number }
  | { kind: 'rawtext'; start: number; end: number }
  | { kind: 'comment'; start: number; end: number }
  | {
      kind: 'start'
      start: number
      end: number
      name: string
      attrs: HtmlAttribute[]
      selfClosing: boolean
    }
  | { kind: 'end'; start: number; end: number; name: string; closesRawText: boolean }

export type HtmlStartTag = Extract<HtmlToken, { kind: 'start' }>

// Элементы, содержимое которых браузер читает как текст до `</имя`.
const RAW_TEXT_ELEMENTS = new Set([
  'script', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'textarea', 'title',
])

const isWhitespace = (code: number) =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d

const isAsciiLetter = (code: number) => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)

type ParsedTag = { end: number; name: string; attrs: HtmlAttribute[]; selfClosing: boolean } | null

/** Имя и атрибуты тега, начиная сразу после `<` или `</`. `null` — тег не закрыт до конца ввода. */
const parseTag = (html: string, from: number): ParsedTag => {
  const length = html.length
  let i = from
  while (i < length) {
    const code = html.charCodeAt(i)
    if (isWhitespace(code) || code === 0x2f || code === 0x3e) break
    i += 1
  }
  const name = html.slice(from, i).toLowerCase()
  const attrs: HtmlAttribute[] = []
  let selfClosing = false

  while (i < length) {
    const code = html.charCodeAt(i)
    if (isWhitespace(code)) {
      i += 1
      continue
    }
    if (code === 0x3e) return { end: i + 1, name, attrs, selfClosing }
    if (code === 0x2f) {
      selfClosing = html.charCodeAt(i + 1) === 0x3e
      i += 1
      continue
    }
    selfClosing = false
    const nameStart = i
    i += 1 // первый символ имени может быть и `=`
    while (i < length) {
      const c = html.charCodeAt(i)
      if (isWhitespace(c) || c === 0x2f || c === 0x3e || c === 0x3d) break
      i += 1
    }
    const attrName = html.slice(nameStart, i).toLowerCase()
    while (i < length && isWhitespace(html.charCodeAt(i))) i += 1
    let value: string | null = null
    if (html.charCodeAt(i) === 0x3d) {
      i += 1
      while (i < length && isWhitespace(html.charCodeAt(i))) i += 1
      const quote = html.charCodeAt(i)
      if (quote === 0x22 || quote === 0x27) {
        const close = html.indexOf(quote === 0x22 ? '"' : "'", i + 1)
        if (close === -1) return null
        value = html.slice(i + 1, close)
        i = close + 1
      } else {
        const valueStart = i
        while (i < length) {
          const c = html.charCodeAt(i)
          if (isWhitespace(c) || c === 0x3e) break
          i += 1
        }
        value = html.slice(valueStart, i)
      }
    }
    // Повторное имя браузер отбрасывает — первое вхождение главное.
    if (!attrs.some((attr) => attr.name === attrName)) attrs.push({ name: attrName, value })
  }
  return null
}

// `toLowerCase()` может менять длину строки (İ → i̇), поэтому поиск — регуляркой по
// исходной строке: индексы остаются индексами `html`.
const RAW_TEXT_END_RE = new Map(
  [...RAW_TEXT_ELEMENTS].map((name) => [name, new RegExp(`</${name}(?=[\\t\\n\\f\\r />]|$)`, 'gi')]),
)

const findRawTextEnd = (html: string, name: string, from: number): number => {
  const pattern = RAW_TEXT_END_RE.get(name)
  if (!pattern) return html.length
  pattern.lastIndex = from
  const match = pattern.exec(html)
  return match ? match.index : html.length
}

const findCommentEnd = (html: string, from: number): number => {
  if (html.startsWith('>', from)) return from + 1
  if (html.startsWith('->', from)) return from + 2
  const close = html.indexOf('-->', from)
  const bang = html.indexOf('--!>', from)
  if (close === -1 && bang === -1) return html.length
  if (bang !== -1 && (close === -1 || bang < close)) return bang + 4
  return close + 3
}

const findBogusCommentEnd = (html: string, from: number): number => {
  const close = html.indexOf('>', from)
  return close === -1 ? html.length : close + 1
}

/**
 * Поток токенов. Незакрытый до конца ввода тег отбрасывается вместе с остатком
 * строки — так же поступает браузер.
 */
export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  const length = html.length
  let i = 0
  let textStart = 0
  const flushText = (end: number) => {
    if (end > textStart) tokens.push({ kind: 'text', start: textStart, end })
  }

  while (i < length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) break
    const next = html.charCodeAt(lt + 1)

    if (next === 0x21 /* ! */ || next === 0x3f /* ? */) {
      flushText(lt)
      const end = html.startsWith('<!--', lt) ? findCommentEnd(html, lt + 4) : findBogusCommentEnd(html, lt + 2)
      tokens.push({ kind: 'comment', start: lt, end })
      i = textStart = end
      continue
    }

    if (next === 0x2f /* / */) {
      const afterSlash = html.charCodeAt(lt + 2)
      if (isAsciiLetter(afterSlash)) {
        const parsed = parseTag(html, lt + 2)
        flushText(lt)
        if (!parsed) {
          textStart = i = length
          break
        }
        tokens.push({ kind: 'end', start: lt, end: parsed.end, name: parsed.name, closesRawText: false })
        i = textStart = parsed.end
        continue
      }
      if (afterSlash === 0x3e) {
        flushText(lt)
        i = textStart = lt + 3
        continue
      }
      if (lt + 2 >= length) break
      flushText(lt)
      const end = findBogusCommentEnd(html, lt + 2)
      tokens.push({ kind: 'comment', start: lt, end })
      i = textStart = end
      continue
    }

    if (!isAsciiLetter(next)) {
      i = lt + 1
      continue
    }

    const parsed = parseTag(html, lt + 1)
    flushText(lt)
    if (!parsed) {
      textStart = i = length
      break
    }
    tokens.push({
      kind: 'start',
      start: lt,
      end: parsed.end,
      name: parsed.name,
      attrs: parsed.attrs,
      selfClosing: parsed.selfClosing,
    })
    i = textStart = parsed.end

    if (parsed.name === 'plaintext') {
      if (i < length) tokens.push({ kind: 'rawtext', start: i, end: length })
      i = textStart = length
      break
    }
    if (RAW_TEXT_ELEMENTS.has(parsed.name)) {
      const rawEnd = findRawTextEnd(html, parsed.name, i)
      if (rawEnd > i) tokens.push({ kind: 'rawtext', start: i, end: rawEnd })
      i = textStart = rawEnd
      if (rawEnd < length) {
        const closing = parseTag(html, rawEnd + 2)
        if (!closing) {
          textStart = i = length
          break
        }
        tokens.push({ kind: 'end', start: rawEnd, end: closing.end, name: parsed.name, closesRawText: true })
        i = textStart = closing.end
      }
    }
  }
  flushText(length)
  return tokens
}

/** `&`, не открывающий ссылку на символ, экранируется; `<`, `>` и кавычка — всегда. */
const NEEDS_ESCAPE_RE = /[&<>"]/

export const escapeHtmlAttributeValue = (raw: string): string =>
  !NEEDS_ESCAPE_RE.test(raw) ? raw : raw
    .replace(/&(?![A-Za-z0-9#])/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const escapeHtmlText = (raw: string): string =>
  !NEEDS_ESCAPE_RE.test(raw) ? raw : raw.replace(/&(?![A-Za-z0-9#])/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const serializeStartTag = (name: string, attrs: readonly HtmlAttribute[]): string => {
  let out = `<${name}`
  for (const attr of attrs) {
    out += attr.value === null ? ` ${attr.name}` : ` ${attr.name}="${escapeHtmlAttributeValue(attr.value)}"`
  }
  return `${out}>`
}

export const getAttribute = (attrs: readonly HtmlAttribute[], name: string): string | null | undefined =>
  attrs.find((attr) => attr.name === name)?.value

/** Заменяет значение на месте или дописывает атрибут в конец. */
export const setAttribute = (attrs: HtmlAttribute[], name: string, value: string | null): void => {
  const existing = attrs.find((attr) => attr.name === name)
  if (existing) existing.value = value
  else attrs.push({ name, value })
}

export const removeAttribute = (attrs: HtmlAttribute[], name: string): void => {
  const index = attrs.findIndex((attr) => attr.name === name)
  if (index !== -1) attrs.splice(index, 1)
}

export type StartTagEditor = (tag: HtmlStartTag, html: string) => void

/**
 * Переписывает открывающие теги с именами из `tagNames` по разобранным атрибутам.
 * Всё остальное копируется из исходной строки без изменений.
 */
export function rewriteStartTags(
  html: string,
  tagNames: readonly string[],
  edit: StartTagEditor,
  options?: { limit?: number },
): string {
  if (!html) return html
  const names = new Set(tagNames)
  let out = ''
  let cursor = 0
  let edited = 0
  for (const token of tokenizeHtml(html)) {
    if (token.kind !== 'start' || !names.has(token.name)) continue
    if (options?.limit !== undefined && edited >= options.limit) break
    edit(token, html)
    out += html.slice(cursor, token.start) + serializeStartTag(token.name, token.attrs)
    cursor = token.end
    edited += 1
  }
  return cursor === 0 && edited === 0 ? html : out + html.slice(cursor)
}

/** Первый открывающий тег `name` в строке либо `null`. */
export const findFirstStartTag = (html: string, name: string): HtmlStartTag | null => {
  if (!html) return null
  for (const token of tokenizeHtml(html)) {
    if (token.kind === 'start' && token.name === name) return token
  }
  return null
}

/** Правка первого открывающего тега `name` в строке; без такого тега строка не меняется. */
export const editFirstStartTag = (
  html: string,
  name: string,
  edit: (attrs: HtmlAttribute[]) => void,
): string => rewriteStartTags(html, [name], ({ attrs }) => edit(attrs), { limit: 1 })

/** Дописывает класс к значению `class` (или добавляет атрибут в конец). */
export const appendClassAttribute = (attrs: HtmlAttribute[], className: string): void => {
  const current = getAttribute(attrs, 'class')
  if (current === undefined) attrs.push({ name: 'class', value: className })
  else setAttribute(attrs, 'class', `${current ?? ''} ${className}`.trim())
}
