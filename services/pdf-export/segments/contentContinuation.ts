import { Parser } from 'htmlparser2'
import type { SafeContentFragment } from '../parsers/incrementalContent'
import { sanitizeRichTextForPdf } from '@/utils/sanitizeRichText'

const MAX_MERGE_CHARS = 32768
const MAX_DEPTH = 32
const LIST_TAGS = new Set(['ol', 'ul'])
type Opening = { name: string; attrs: Record<string, string>; start: number; end: number }

function invalid(): never {
  throw new Error('CONTENT_CONTINUATION_INVALID')
}

/** Quoted `>` is legal in sanitized attributes; do not slice tags with `[^>]*`. */
function openingAt(html: string, offset: number): Opening {
  const match = /^<([a-z][a-z\d:-]*)\b/i.exec(html.slice(offset))
  if (!match) return invalid()
  let quote = ''
  let end = offset + match[0].length
  for (; end < html.length; end++) {
    const char = html[end]
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '>') {
      break
    }
  }
  if (end >= html.length) return invalid()
  let result: Opening | undefined
  const parser = new Parser({ onopentag(name, attrs) { result = { name, attrs, start: offset, end: end + 1 } } })
  parser.end(html.slice(offset, end + 1))
  return result || invalid()
}

/** Untrusted/source-only containers may have been discarded by the canonical policy. */
function canonicalPath(path: string[]): string[] {
  if (path.length > MAX_DEPTH) return invalid()
  return path.flatMap((name) => {
    if (!/^[a-z][a-z\d:-]*$/.test(name) || name.length > 256) return invalid()
    const sanitized = sanitizeRichTextForPdf(`<${name}>continuation</${name}>`)
    const normalized = /^<([a-z][a-z\d:-]*)\b/i.exec(sanitized)?.[1]
    // An iframe needs its source to remain an iframe; the empty sample becomes a div.
    return normalized ? [name === 'iframe' ? name : normalized] : []
  })
}

function sameAttributes(left: Record<string, string>, right: Record<string, string>, list: boolean): boolean {
  const keys = (attrs: Record<string, string>) => Object.keys(attrs)
    .filter((key) => key !== 'id' && key !== 'name' && !(list && key === 'start')).sort()
  const leftKeys = keys(left)
  const rightKeys = keys(right)
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && left[key] === right[key])
}

function openAncestors(html: string): Array<{ name: string; attrs: Record<string, string> }> {
  const stack: Array<{ name: string; attrs: Record<string, string> }> = []
  const parser = new Parser({
    onopentag(name, attrs) {
      stack.push({ name, attrs })
      if (stack.length > MAX_DEPTH) invalid()
    },
    onclosetag(name) {
      const at = stack.map((entry) => entry.name).lastIndexOf(name)
      if (at >= 0) stack.length = at
    },
  })
  // Do not call end(): remaining ancestors are deliberately open at the splice.
  parser.write(html)
  return stack
}

/**
 * Reconnect only the ancestors that the streaming parser deliberately closed.
 * The first opening retains its attributes/destination, and the next fragment's
 * repeated openings disappear. A new physical page can start with previous="".
 * Inputs and temporary SAX state are bounded; the page owner applies its 24k cap
 * to this candidate before committing it to the current measured page.
 */
export function mergeContentContinuation(previous: string, fragment: SafeContentFragment): string {
  if (previous.length + fragment.html.length > MAX_MERGE_CHARS) {
    throw new Error('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  }
  if (!previous || !fragment.continuation) return previous + fragment.html
  const path = canonicalPath(fragment.continuationPath)
  if (!path.length) return previous + fragment.html
  const nextOpenings: Opening[] = []
  let offset = 0
  for (const name of path) {
    const opening = openingAt(fragment.html, offset)
    if (opening.name !== name && !(LIST_TAGS.has(name) && LIST_TAGS.has(opening.name))) return invalid()
    nextOpenings.push(opening)
    offset = opening.end
  }
  let previousEnd = previous.length
  let matched = 0
  for (const opening of nextOpenings) {
    const close = /<\/([a-z][a-z\d:-]*)\s*>\s*$/i.exec(previous.slice(0, previousEnd))
    if (!close) return invalid()
    if (close[1].toLowerCase() !== opening.name) {
      // Quill's mixed numbered/bulleted runs legitimately change the outer list.
      // Reconnect their common ancestors but preserve the distinct list boundary.
      if (LIST_TAGS.has(close[1].toLowerCase()) && LIST_TAGS.has(opening.name)) break
      return invalid()
    }
    previousEnd = close.index
    matched++
  }
  if (!matched) return previous + fragment.html
  const ancestors = openAncestors(previous.slice(0, previousEnd))
  if (ancestors.length !== matched) return invalid()
  for (let index = 0; index < matched; index++) {
    if (ancestors[index].name !== nextOpenings[index].name
      || !sameAttributes(ancestors[index].attrs, nextOpenings[index].attrs, LIST_TAGS.has(ancestors[index].name))) return invalid()
  }
  const nextStart = nextOpenings[matched - 1].end
  return previous.slice(0, previousEnd) + fragment.html.slice(nextStart)
}

/**
 * Preserve column positions and a small persisted header on a new physical page.
 * These are derived layout elements: original source text/media counters and
 * occurrence indexes remain attached to the unchanged source fragment.
 */
export function continueContentOnPage(fragment: SafeContentFragment, headerHtml?: string): SafeContentFragment {
  const context = fragment.tableContinuation
  const lists = fragment.listContinuation ?? []
  if (!fragment.continuation || (!context && !lists.length)) return fragment
  if (fragment.html.length > MAX_MERGE_CHARS || (headerHtml?.length || 0) > 4096) {
    throw new Error('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  }
  const column = context?.cellIndex ?? 0
  if (!Number.isSafeInteger(column) || column < 0) return invalid()
  const path = canonicalPath(fragment.continuationPath)
  const openings: Opening[] = []
  let offset = 0
  for (const name of path) {
    const opening = openingAt(fragment.html, offset)
    if (opening.name !== name && !(LIST_TAGS.has(name) && LIST_TAGS.has(opening.name))) return invalid()
    openings.push(opening)
    offset = opening.end
  }
  const table = openings.find((opening) => opening.name === 'table')
  const row = openings.find((opening) => opening.name === 'tr')
  if (context && (!table || (column && !row))) return invalid()
  const cell = context?.header ? 'th' : 'td'
  const placeholder = `<${cell} aria-hidden="true"></${cell}>`
  let header = ''
  if (context && !context.header && headerHtml) {
    header = sanitizeRichTextForPdf(headerHtml, { suppressAutomaticHeadingAnchors: true })
      .replace(/\s(?:id|name)=(['"])[\s\S]*?\1/gi, '')
    if (!/^<thead(?:\s|>)/i.test(header) || !/<\/thead>$/i.test(header)) return invalid()
  }
  if (fragment.html.length + header.length + column * placeholder.length > MAX_MERGE_CHARS) {
    throw new Error('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  }
  const inserts: Array<{ at: number; html: string; remove?: number }> = []
  let listIndex = 0
  for (const opening of openings.filter((entry) => LIST_TAGS.has(entry.name))) {
    const item = lists[listIndex++]?.item
    if (item === undefined) continue
    if (!Number.isSafeInteger(item)) return invalid()
    if (opening.name === 'ol') {
      const existing = /\sstart=(?:"[^"]*"|'[^']*')/i.exec(fragment.html.slice(opening.start, opening.end))
      inserts.push({ at: existing ? opening.start + existing.index : opening.end - 1,
        html: ` start="${item}"`, ...(existing ? { remove: existing[0].length } : {}) })
    }
  }
  if (header) inserts.push({ at: table!.end, html: header })
  if (column) inserts.push({ at: row!.end, html: placeholder.repeat(column) })
  if (fragment.html.length + inserts.reduce((total, insert) => total + insert.html.length - (insert.remove ?? 0), 0) > MAX_MERGE_CHARS) {
    throw new Error('CONTENT_CONTINUATION_BUDGET_EXCEEDED')
  }
  let html = fragment.html
  for (const insert of inserts.sort((left, right) => right.at - left.at)) {
    html = html.slice(0, insert.at) + insert.html + html.slice(insert.at + (insert.remove ?? 0))
  }
  return { ...fragment, html }
}
