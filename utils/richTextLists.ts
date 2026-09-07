const LIST_BLOCK_RE = /<\s*(ol|ul)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi
const ORDERED_START_RE = /\bstart\s*=\s*(["']?)(\d+)\1/i

const countListItems = (html: string): number => html.match(/<\s*li\b/gi)?.length ?? 0

const readOrderedStart = (html: string): number | null => {
  const match = html.match(ORDERED_START_RE)
  if (!match?.[2]) return null
  const value = Number(match[2])
  return Number.isFinite(value) && value > 0 ? value : null
}

const addOrderedStart = (html: string, start: number): string => {
  if (ORDERED_START_RE.test(html)) return html
  return html.replace(/<\s*ol\b([^>]*)>/i, (_match, attrs = '') => `<ol${attrs} start="${start}">`)
}

// Quill 2 держит служебную разметку пункта списка в `data-list` и в пустом
// `<span class="ql-ui">`. Ни backend safe_html (`GLOBAL_ATTRS` + `TAG_ATTRS`
// в `metravel/common/rich_text.py` не знают `data-list`), ни SSG, ни
// native-рендерер этого словаря не понимают, поэтому транспортную разметку
// редактора приводим к семантическим `<ul>`/`<ol>` — тег переживает любой
// downstream, атрибут не переживает ни одного. В allowlist'ах
// (`utils/articleEditorSanitize.ts`, `utils/sanitizeRichText.ts`) `data-list`
// оставлен ровно затем, чтобы дожить до этой функции: оба санитайзера зовут её
// на СВОЁМ выходе, когда sanitize-html уже достроил незакрытые теги.
const QUILL_UI_SPAN_RE =
  /<span\b(?=[^>]*\bclass\s*=\s*(?:"[^"]*\bql-ui\b[^"]*"|'[^']*\bql-ui\b[^']*'))[^>]*>\s*<\/span\s*>/gi
// Легаси-хвост уже сохранённых статей: класс `ql-ui` с них снял прежний
// санитайзер, остался бессодержательный `<span></span>` без атрибутов.
// `<span id="...">` (якорь заголовка) под правило не подпадает.
// Содержимое переносится наружу, а не удаляется вместе с тегом: в живых телах
// статей встречается `слово<span> </span>другое` — пробел там единственный
// разделитель слов, и его потеря склеила бы текст (уже опубликованные travel
// 438, 194, 228, 532).
const EMPTY_BARE_SPAN_RE = /<span\s*>(\s*)<\/span\s*>/gi
const LIST_ITEM_RE = /<li\b([^>]*)>([\s\S]*?)<\/li\s*>/gi
const LIST_TAG_RE = /<\s*\/?\s*(?:ol|ul)\b/gi
const LIST_OPEN_TAG_RE = /^<\s*(?:ol|ul)\b[^>]*>/i
const LIST_CLOSE_TAG_RE = /<\/\s*(?:ol|ul)\s*>$/i
const DATA_LIST_RE = /\s*\bdata-list\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const DATA_LIST_PRESENCE_RE = /\bdata-list\s*=/i

const readQuillListType = (attrs: string): string | null => {
  const match = attrs.match(DATA_LIST_RE)
  if (!match) return null
  const value = String(match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase()
  return value || null
}

// Пересобрать блок можно только из закрытых `<li>…</li>` и ничего кроме них:
// пункт без `</li>`, текст между пунктами или вложенный список в пробеги не
// попадают, и молча исчезли бы из статьи (вложенный — ещё и с перекрёстными
// тегами, потому что `LIST_BLOCK_RE` обрывает блок на первом `</ol>`). Такой
// блок остаётся как есть: `data-list` на нём переживает allowlist
// (`utils/sanitizeRichText.ts`), sanitize-html достраивает закрывающие теги, и
// следующий прогон нормализации уже разбирает блок корректно.
const isPlainItemSequence = (block: string, items: RegExpMatchArray[]): boolean => {
  if (items.length === 0) return false
  if (countListItems(block) !== items.length) return false
  if ((block.match(LIST_TAG_RE)?.length ?? 0) !== 2) return false

  let cursor = 0
  let outsideItems = ''

  for (const item of items) {
    const index = item.index ?? 0
    outsideItems += block.slice(cursor, index)
    cursor = index + item[0].length
  }
  outsideItems += block.slice(cursor)

  return !outsideItems.replace(LIST_OPEN_TAG_RE, '').replace(LIST_CLOSE_TAG_RE, '').trim()
}

// Quill складывает подряд идущие пункты обоих типов в один `<ol>`, поэтому блок
// режется на пробеги по типу пункта: буллеты уходят в `<ul>`, нумерация — в `<ol>`.
const rebuildQuillListBlock = (block: string, containerTag: 'ol' | 'ul'): string => {
  const items = [...block.matchAll(LIST_ITEM_RE)]
  if (!items.some((item) => readQuillListType(String(item[1] ?? '')) !== null)) return block
  if (!isPlainItemSequence(block, items)) return block

  const runs: { tag: 'ol' | 'ul'; items: string[] }[] = []

  for (const item of items) {
    const rawAttrs = String(item[1] ?? '')
    const listType = readQuillListType(rawAttrs)
    // `checked`/`unchecked` (чек-листы Quill) в тулбаре редактора не включены;
    // если такой пункт всё же придёт, он остаётся в исходном контейнере.
    const tag = listType === 'ordered' ? 'ol' : listType === 'bullet' ? 'ul' : containerTag
    // Только `data-list`: схлопывать пробелы во всей строке атрибутов нельзя —
    // это правило пришлось бы и на значения (`title`, `aria-label`, `style`).
    const attrs = rawAttrs.replace(DATA_LIST_RE, '').trim()
    const rebuiltItem = `<li${attrs ? ` ${attrs}` : ''}>${String(item[2] ?? '')}</li>`
    const currentRun = runs[runs.length - 1]

    if (currentRun?.tag === tag) currentRun.items.push(rebuiltItem)
    else runs.push({ tag, items: [rebuiltItem] })
  }

  return runs.map((run) => `<${run.tag}>${run.items.join('')}</${run.tag}>`).join('')
}

/**
 * Приводит транспортную разметку списков Quill 2 к семантической: `<ol>` с
 * `<li data-list="bullet">` становится `<ul>`, служебный пустой `<span>` пункта
 * не попадает в сохранённое тело статьи. Идемпотентна: разметка без `data-list`
 * возвращается как есть, поэтому уже сохранённые списки не переписываются.
 */
export const normalizeQuillListMarkup = (html: string): string => {
  const source = String(html ?? '')
  if (!source) return ''

  const withoutEditorSpans = source.replace(QUILL_UI_SPAN_RE, '').replace(EMPTY_BARE_SPAN_RE, '$1')
  if (!DATA_LIST_PRESENCE_RE.test(withoutEditorSpans)) return withoutEditorSpans

  return withoutEditorSpans.replace(LIST_BLOCK_RE, (block: string, tagName: string) =>
    rebuildQuillListBlock(block, String(tagName).toLowerCase() === 'ul' ? 'ul' : 'ol'),
  )
}

export const normalizeRichTextListFragments = (html: string): string => {
  if (!html) return ''

  const source = normalizeQuillListMarkup(html)

  let output = ''
  let lastIndex = 0
  let nextOrderedStart = 1
  let hasOrderedListInRun = false

  const resetListRun = () => {
    nextOrderedStart = 1
    hasOrderedListInRun = false
  }

  for (const match of source.matchAll(LIST_BLOCK_RE)) {
    const block = match[0]
    const tagName = String(match[1] || '').toLowerCase()
    const index = match.index ?? 0
    const between = source.slice(lastIndex, index)

    output += between

    if (between.trim()) {
      resetListRun()
    }

    if (tagName !== 'ol') {
      output += block
      lastIndex = index + block.length
      continue
    }

    const explicitStart = readOrderedStart(block)
    const itemCount = countListItems(block)
    const start = explicitStart ?? (hasOrderedListInRun && nextOrderedStart > 1 ? nextOrderedStart : null)
    const normalizedBlock = start ? addOrderedStart(block, start) : block

    output += normalizedBlock
    hasOrderedListInRun = true

    const effectiveStart = explicitStart ?? start ?? 1
    if (itemCount > 0) {
      nextOrderedStart = effectiveStart + itemCount
    }

    lastIndex = index + block.length
  }

  output += source.slice(lastIndex)
  return output
}
