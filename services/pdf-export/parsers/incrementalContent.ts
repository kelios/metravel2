import { Parser } from 'htmlparser2'
import { IncrementalContentError } from '@/services/pdf-export/parsers/incrementalContentError'
export { IncrementalContentError } from '@/services/pdf-export/parsers/incrementalContentError'
import { sanitizeRichTextForPdf } from '@/utils/sanitizeRichText'
import { validateFragmentWriterCheckpoint, type FragmentWriterCheckpoint, type FragmentOpenElement } from '@/services/pdf-export/parsers/incrementalContentState'

/** Transfer/working-set budgets, never a limit on the total source length. */
export interface IncrementalContentOptions {
  maxFragmentChars?: number
  maxTokenChars?: number
  maxDepth?: number
  maxInputChunkChars?: number
  headingAnchorResolver?: (ordinal: number) => string | undefined
  /** Prepared page subdivision retains derived list starts; authored HTML uses the canonical policy. */
  preserveListStarts?: boolean
  /** Private worker print policy; default ingestion retains authored disclosure elements. */
  expandDisclosures?: boolean
  onMetrics?: (metrics: IncrementalContentMetrics) => void
}

export interface IncrementalContentMetrics {
  fragments: number
  sourceTextChars: number
  images: number
  peakBufferedChars: number
  peakDepth: number
}

export interface SafeContentFragment {
  index: number
  html: string
  /** The first characters continue an open source element, not a new paragraph. */
  continuation: boolean
  continuationPath: string[]
  /** Source coordinates distinguish a split cell from the next row/cell. */
  tableContinuation?: { tableIndex: number; rowIndex?: number; cellIndex?: number; header: boolean }
  listContinuation?: Array<{ item: number }>
  sourceTextChars: number
  /** Original URLs and source-order indexes survive sanitization/URL rewriting. */
  imageOccurrences: Array<{ index: number; source: string }>
}

const VOID_TAGS = new Set([
  'area', 'base', 'basefont', 'br', 'col', 'embed', 'frame', 'hr', 'img', 'input',
  'isindex', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const OMIT_CONTENT = new Set([
  'script', 'style', 'textarea', 'option', 'scrollview', 'touchableopacity',
  'touchablehighlight', 'flatlist', 'sectionlist',
])
const UNWRAP = new Set(['html', 'body', 'view', 'text', 'safeareaview'])
const BLOCK_BOUNDARIES = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote',
  'figure', 'table', 'pre', 'details', 'iframe',
])

const escapeText = (value: string): string => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (value: string): string => escapeText(value).replace(/"/g, '&quot;')

function budget(value: number | undefined, fallback: number, minimum: number): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < minimum) {
    throw new IncrementalContentError('INVALID_INGESTION_BUDGET')
  }
  return resolved
}

/**
 * htmlparser2 streams text but retains an unfinished tag/attribute/comment.
 * Scan those tokens before feeding it, so even a never-closed comment stays
 * within the declared budget. No source token or field is accumulated here.
 */
export interface TokenBudgetCheckpoint {version: 1; maximum: number; length: number; prefix: string; tail: string; quote: string; comment: boolean; cdata: boolean}

export class TokenBudget {
  private length = 0
  private prefix = ''
  private tail = ''
  private quote = ''
  private comment = false
  private cdata = false

  constructor(private readonly maximum: number) {}

  save(): TokenBudgetCheckpoint {
    return {version: 1, maximum: this.maximum, length: this.length, prefix: this.prefix, tail: this.tail, quote: this.quote, comment: this.comment, cdata: this.cdata}
  }

  restore(value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IncrementalContentError('TOKEN_CHECKPOINT_INVALID')
    const state = value as Record<string, unknown>
    if (state.version !== 1 || state.maximum !== this.maximum || !Number.isSafeInteger(state.length) || typeof state.length !== 'number' || state.length < 0 || state.length > this.maximum
      || typeof state.prefix !== 'string' || state.prefix.length > 9 || typeof state.tail !== 'string' || state.tail.length > 3
      || !['', '"', "'"].includes(state.quote as string) || typeof state.comment !== 'boolean' || typeof state.cdata !== 'boolean') throw new IncrementalContentError('TOKEN_CHECKPOINT_INVALID')
    this.length = state.length; this.prefix = state.prefix; this.tail = state.tail; this.quote = state.quote as string
    this.comment = state.comment; this.cdata = state.cdata
  }

  feed(chunk: string): void {
    for (const char of chunk) {
      if (!this.length) {
        if (char === '<') {
          this.length = 1
          this.prefix = '<'
        }
        continue
      }
      this.length += char.length
      if (this.length > this.maximum) throw new IncrementalContentError('SOURCE_TOKEN_TOO_LARGE')
      if (this.prefix.length < 9) this.prefix += char
      if (this.prefix.length === 2 && !/[a-zA-Z!/?]/.test(char)) {
        this.reset()
        if (char === '<') {
          this.length = 1
          this.prefix = '<'
        }
        continue
      }
      this.comment ||= this.prefix === '<!--'
      this.cdata ||= this.prefix === '<![CDATA['
      this.tail = (this.tail + char).slice(-3)
      if (this.comment || this.cdata) {
        if (this.tail === (this.comment ? '-->' : ']]>')) this.reset()
      } else if (this.quote) {
        if (char === this.quote) this.quote = ''
      } else if (char === '"' || char === "'") {
        this.quote = char
      } else if (char === '>') {
        this.reset()
      }
    }
  }

  private reset(): void {
    this.length = 0
    this.prefix = ''
    this.tail = ''
    this.quote = ''
    this.comment = false
    this.cdata = false
  }
}

export class FragmentWriter {
  readonly ready: SafeContentFragment[] = []
  readonly metrics: IncrementalContentMetrics = {
    fragments: 0, sourceTextChars: 0, images: 0, peakBufferedChars: 0, peakDepth: 0,
  }
  private readonly stack: FragmentOpenElement[] = []
  private parts: string[] = []
  private chars = 0
  private textChars = 0
  private images: SafeContentFragment['imageOccurrences'] = []
  private payload = false
  private continuedPath: string[] = []
  private tableContinuation?: SafeContentFragment['tableContinuation']
  private listContinuation?: SafeContentFragment['listContinuation']
  private nextTable = 0
  private pendingSurrogate = ''
  private plainText = false
  private omittedDepth = 0
  private readonly rawBudget: number

  constructor(
    private readonly maxFragment: number,
    private readonly maxDepth: number,
    private readonly headingAnchorResolver?: IncrementalContentOptions['headingAnchorResolver'],
    private readonly preserveListStarts = false,
    private readonly expandDisclosures = false,
  ) {
    // Leave room for sanitizer-added attributes and first-party image rewrites.
    this.rawBudget = Math.floor(maxFragment / 2)
  }

  save(anchorPolicy = ''): FragmentWriterCheckpoint {
    if (this.ready.length) throw new IncrementalContentError('FRAGMENT_CHECKPOINT_QUEUE_NOT_DRAINED')
    if (this.headingAnchorResolver && !anchorPolicy) throw new IncrementalContentError('FRAGMENT_CHECKPOINT_ANCHOR_POLICY_REQUIRED')
    return validateFragmentWriterCheckpoint({version: 1,
      policy: {maxFragment: this.maxFragment, maxDepth: this.maxDepth, preserveListStarts: this.preserveListStarts, expandDisclosures: this.expandDisclosures, anchorPolicy},
      stack: this.stack, parts: this.parts, chars: this.chars, textChars: this.textChars, images: this.images,
      payload: this.payload, continuedPath: this.continuedPath, tableContinuation: this.tableContinuation,
      listContinuation: this.listContinuation, nextTable: this.nextTable, pendingSurrogate: this.pendingSurrogate,
      plainText: this.plainText, omittedDepth: this.omittedDepth, metrics: this.metrics})
  }

  restore(value: unknown, anchorPolicy = ''): void {
    if (this.ready.length) throw new IncrementalContentError('FRAGMENT_CHECKPOINT_QUEUE_NOT_DRAINED')
    const state = validateFragmentWriterCheckpoint(value)
    if (JSON.stringify(state.policy) !== JSON.stringify(this.save(anchorPolicy).policy)) throw new IncrementalContentError('FRAGMENT_CHECKPOINT_POLICY_MISMATCH')
    this.stack.splice(0, this.stack.length, ...state.stack); this.parts = state.parts; this.chars = state.chars
    this.textChars = state.textChars; this.images = state.images; this.payload = state.payload
    this.continuedPath = state.continuedPath; this.tableContinuation = state.tableContinuation
    this.listContinuation = state.listContinuation; this.nextTable = state.nextTable; this.pendingSurrogate = state.pendingSurrogate
    this.plainText = state.plainText; this.omittedDepth = state.omittedDepth; Object.assign(this.metrics, state.metrics)
  }

  open(originalName: string, attrs: Record<string, string>): void {
    this.finishSurrogate()
    this.closePlainText()
    const name = originalName.toLowerCase()
    const emittedName = this.expandDisclosures && name === 'details' ? 'div'
      : this.expandDisclosures && name === 'summary' && this.stack.at(-1)?.name === 'details' ? 'h4' : name
    const isVoid = VOID_TAGS.has(name)
    const omitted = !!this.omittedDepth || OMIT_CONTENT.has(name) || name === 'image'
    if (!isVoid && this.stack.length >= this.maxDepth) {
      throw new IncrementalContentError('SOURCE_NESTING_TOO_DEEP')
    }
    const open = omitted || UNWRAP.has(name) ? '' : `<${emittedName}${Object.entries(attrs)
      .map(([key, value]) => ` ${key.toLowerCase()}="${escapeAttribute(value)}"`).join('')}>`
    const close = open && !isVoid ? `</${emittedName}>` : ''
    // The source destination exists only once, even when its element continues.
    const reopen = open ? `<${emittedName}${Object.entries(attrs)
      .filter(([key]) => !['id', 'name'].includes(key.toLowerCase()))
      .map(([key, value]) => ` ${key.toLowerCase()}="${escapeAttribute(value)}"`).join('')}>` : ''
    if (open) {
      this.room(open.length + close.length)
      this.append(open)
      if (isVoid) this.payload = true
      if (name === 'img') {
        const source = attrs.src || attrs['data-src'] || attrs['data-original'] || attrs['data-lazy-src']
        if (!source) throw new IncrementalContentError('MEDIA_SOURCE_INVALID')
        this.images.push({ index: this.metrics.images++, source })
      }
    }
    if (!isVoid) {
      const element: FragmentOpenElement = { name, emittedName, open, reopen, close, omitted }
      if (name === 'table') {
        element.tableIndex = this.nextTable++
        element.nextChild = 0
      } else if (name === 'ol' || name === 'ul') {
        const start = Number(attrs.start)
        element.nextChild = this.preserveListStarts && Number.isSafeInteger(start) ? start : 1
      } else if (name === 'li') {
        const list = !omitted && this.stack.slice().reverse().find((entry) => entry.open && (entry.name === 'ol' || entry.name === 'ul'))
        if (list) {
          const type = attrs['data-list'] === 'bullet' ? 'ul' : attrs['data-list'] === 'ordered' ? 'ol' : list.name as 'ol' | 'ul'
          if (list.listRun && list.listRun !== type) list.nextChild = 1
          list.listRun = type
          element.listItem = list.nextChild!++
          // A budget break just before a new Quill run reopened only its source list.
          if (!this.payload && list === this.stack.at(-1) && this.listContinuation?.length) {
            this.listContinuation[this.listContinuation.length - 1].item = element.listItem
          }
        }
      } else if (name === 'tr') {
        const table = this.stack.slice().reverse().find((entry) => entry.name === 'table')
        if (table) element.rowIndex = table.nextChild!++
        element.nextChild = 0
      } else if (name === 'td' || name === 'th') {
        const row = this.stack.slice().reverse().find((entry) => entry.name === 'tr')
        if (row) element.cellIndex = row.nextChild!++
      }
      this.stack.push(element)
      if (omitted) this.omittedDepth++
      this.metrics.peakDepth = Math.max(this.metrics.peakDepth, this.stack.length)
    }
  }

  close(originalName: string): void {
    this.finishSurrogate()
    const name = originalName.toLowerCase()
    if (VOID_TAGS.has(name)) return
    const position = this.stack.map((entry) => entry.name).lastIndexOf(name)
    if (position < 0) return
    while (this.stack.length > position) {
      const element = this.stack.pop()!
      if (element.omitted) this.omittedDepth--
      if (element.close) this.append(element.close)
    }
    // Do not break a table/list after every nested paragraph: its structure is
    // kept whole while it fits, and only split when its budget is exhausted.
    if (BLOCK_BOUNDARIES.has(name) && !this.stack.some((entry) =>
      ['table', 'ul', 'ol', 'figure', 'blockquote', 'pre'].includes(entry.name))) {
      this.flush()
    }
  }

  text(data: string): void {
    if (this.omittedDepth || !data) return
    const text = this.pendingSurrogate + data
    this.pendingSurrogate = ''
    let end = text.length
    const last = text.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) {
      this.pendingSurrogate = text.slice(-1)
      end--
    }
    for (const char of text.slice(0, end)) this.character(char)
  }

  finish(): void {
    this.finishSurrogate()
    this.closePlainText()
    this.flush()
  }

  private finishSurrogate(): void {
    if (this.pendingSurrogate) {
      const char = this.pendingSurrogate
      this.pendingSurrogate = ''
      this.character(char)
    }
  }

  private character(char: string): void {
    if (!this.stack.some((entry) => entry.open) && !this.plainText) {
      this.room(7)
      this.append('<p>')
      this.plainText = true
    }
    const escaped = escapeText(char)
    this.room(escaped.length)
    this.append(escaped)
    this.payload = true
    this.textChars += char.length
    this.metrics.sourceTextChars += char.length
  }

  private closePlainText(): void {
    if (!this.plainText) return
    this.append('</p>')
    this.plainText = false
    this.flush()
  }

  private suffix(): string {
    return (this.plainText ? '</p>' : '') + this.stack.slice().reverse().map((entry) => entry.close).join('')
  }

  private room(additional: number): void {
    if (this.chars + additional + this.suffix().length <= this.rawBudget) return
    this.flush()
    if (this.chars + additional + this.suffix().length > this.rawBudget) {
      throw new IncrementalContentError('SOURCE_WRAPPER_TOO_LARGE')
    }
  }

  private append(value: string): void {
    this.parts.push(value)
    this.chars += value.length
    this.metrics.peakBufferedChars = Math.max(this.metrics.peakBufferedChars, this.chars + this.suffix().length)
  }

  private flush(): void {
    if (this.payload) {
      const html = sanitizeRichTextForPdf(this.parts.join('') + this.suffix(), {
        headingAnchorResolver: this.headingAnchorResolver,
        suppressAutomaticHeadingAnchors: this.continuedPath.some((tag) => /^h[1-3]$/.test(tag)),
        preserveOrderedListStarts: this.preserveListStarts,
      })
      if (html.length > this.maxFragment) throw new IncrementalContentError('SANITIZED_FRAGMENT_TOO_LARGE')
      if (html) {
        this.ready.push({
          index: this.metrics.fragments++, html,
          continuation: this.continuedPath.length > 0,
          continuationPath: this.continuedPath,
          ...(this.tableContinuation ? { tableContinuation: this.tableContinuation } : {}),
          ...(this.listContinuation?.length ? { listContinuation: this.listContinuation } : {}),
          sourceTextChars: this.textChars,
          imageOccurrences: this.images,
        })
      }
    }
    this.continuedPath = this.stack.filter((entry) => entry.open).map((entry) => entry.emittedName)
    const table = this.stack.slice().reverse().find((entry) => entry.name === 'table')
    const row = this.stack.slice().reverse().find((entry) => entry.name === 'tr')
    const cell = this.stack.slice().reverse().find((entry) => entry.name === 'td' || entry.name === 'th')
    this.tableContinuation = table ? {
      tableIndex: table.tableIndex!, rowIndex: row?.rowIndex, cellIndex: cell?.cellIndex,
      header: cell?.name === 'th' || this.continuedPath.includes('thead'),
    } : undefined
    this.listContinuation = this.stack.flatMap((entry, index) => {
      if (!entry.open || (entry.name !== 'ol' && entry.name !== 'ul')) return []
      const item = this.stack.slice(index + 1).find((child) => child.name === 'li')
      return [{ item: item?.listItem ?? entry.nextChild! }]
    })
    if (this.plainText) this.continuedPath.push('p')
    this.parts = this.stack.filter((entry) => entry.open).map((entry) => entry.reopen)
    if (this.plainText) this.parts.push('<p>')
    this.chars = this.parts.reduce((sum, part) => sum + part.length, 0)
    this.textChars = 0
    this.images = []
    this.payload = false
  }
}

/**
 * Feed bounded decoded source chunks. SAX never constructs a whole-field tree.
 * Fragments are balanced and independently sanitized by the existing PDF policy.
 * continuationPath preserves table/cell/link semantics for physical pagination;
 * the consumer must not turn each continuation into a new logical paragraph.
 */
export async function* incrementalContent(
  source: AsyncIterable<string>,
  options: IncrementalContentOptions = {},
): AsyncGenerator<SafeContentFragment> {
  const maxFragment = budget(options.maxFragmentChars, 1024, 256)
  const maxToken = budget(options.maxTokenChars, 65536, 64)
  const maxDepth = budget(options.maxDepth, 32, 1)
  const maxInput = budget(options.maxInputChunkChars, 65536, 1)
  const writer = new FragmentWriter(maxFragment, maxDepth, options.headingAnchorResolver, options.preserveListStarts, options.expandDisclosures)
  const tokenBudget = new TokenBudget(maxToken)
  const parser = new Parser({
    onopentag: (name, attrs) => writer.open(name, attrs),
    onclosetag: (name) => writer.close(name),
    ontext: (text) => writer.text(text),
    onerror: (error) => { throw error },
  }, { decodeEntities: true, lowerCaseTags: false, lowerCaseAttributeNames: true })
  // Bound the callback queue even when a transfer chunk contains many elements.
  const feedSize = Math.min(256, Math.floor(maxFragment / 4))
  for await (const chunk of source) {
    if (typeof chunk !== 'string' || chunk.length > maxInput) {
      throw new IncrementalContentError('SOURCE_CHUNK_TOO_LARGE')
    }
    for (let offset = 0; offset < chunk.length; offset += feedSize) {
      const part = chunk.slice(offset, offset + feedSize)
      tokenBudget.feed(part)
      parser.write(part)
      while (writer.ready.length) yield writer.ready.shift()!
    }
  }
  parser.end()
  writer.finish()
  while (writer.ready.length) yield writer.ready.shift()!
  options.onMetrics?.({ ...writer.metrics })
}
