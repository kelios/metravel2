// #2389: allowlist of inline `style` declarations in rich text, owned here
// instead of sanitize-html's `allowedStyles`. That option parses every style
// attribute with postcss — 53 KB raw of a CSS toolchain in the web bundle to
// split `prop: value; …`. This filter does the same job with the same output
// format (`prop:value;prop:value !important`) and runs identically on web,
// native and in Node, so SSR, the editor write path and the reader agree.
//
// Safety does not depend on parsing finesse: a declaration survives only when
// its property is listed below and its whole value matches an anchored regex
// of plain lengths, keywords or colours. Anything the splitter cannot read
// unambiguously (braces, an unclosed string, comment or bracket) drops the
// whole attribute, as a postcss syntax error did. The sanitize-html postcss
// parser is replaced on web by `metro-stubs/sanitize-html-postcss.js`;
// `__tests__/utils/richTextStyleFilter.test.ts` compares this filter with the
// postcss path on the same inputs.

// sanitize-html's `Attributes`, kept local so this module stays off the
// sanitize-html caller list of __tests__/scripts/sanitize-html-postcss-stub.test.ts.
type Attributes = Record<string, string>

const COLOR_RE =
  /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent)$/i
const LENGTH_TOKEN = '-?\\d+(?:\\.\\d+)?(?:px|em|rem|%|pt)?'
const MARGIN_TOKEN = `(?:${LENGTH_TOKEN}|auto)`
const MARGIN_RE = new RegExp(`^${MARGIN_TOKEN}( +${MARGIN_TOKEN}){0,3}$`, 'i')
const PADDING_RE = new RegExp(`^${LENGTH_TOKEN}( +${LENGTH_TOKEN}){0,3}$`, 'i')
const LENGTH_OR_AUTO_RE = new RegExp(`^(?:${LENGTH_TOKEN}|auto)$`, 'i')
const LENGTH_ONLY_RE = new RegExp(`^${LENGTH_TOKEN}$`, 'i')

type StyleRules = Readonly<Record<string, readonly RegExp[]>>

export const RICH_TEXT_ALLOWED_STYLES: Readonly<Record<string, StyleRules>> = {
  '*': {
    'text-align': [/^(left|right|center|justify)$/],
    float: [/^(left|right|none)$/],
    margin: [MARGIN_RE],
    'margin-left': [LENGTH_OR_AUTO_RE],
    'margin-right': [LENGTH_OR_AUTO_RE],
    'margin-top': [LENGTH_ONLY_RE],
    'margin-bottom': [LENGTH_ONLY_RE],
    padding: [PADDING_RE],
    color: [COLOR_RE],
    'background-color': [COLOR_RE],
    background: [COLOR_RE],
    display: [/^(block|inline-block|inline)$/],
  },
  img: {
    width: [/^\d+(px|%)$/],
    height: [/^\d+(px|%)$/],
  },
}

const IMPORTANT_RE = /\s*!\s*important\s*$/i

/**
 * Splits a style attribute into declaration strings at top-level `;`, with
 * comments removed. `null` means the text is not a plain declaration list.
 */
function splitDeclarations(style: string): string[] | null {
  const declarations: string[] = []
  let current = ''
  let quote = ''
  let depth = 0
  for (let i = 0; i < style.length; i++) {
    const char = style[i]
    if (quote) {
      current += char
      if (char === '\\') {
        current += style[++i] ?? ''
      } else if (char === quote) {
        quote = ''
      }
      continue
    }
    if (char === '/' && style[i + 1] === '*') {
      const end = style.indexOf('*/', i + 2)
      if (end === -1) return null
      i = end + 1
      continue
    }
    if (char === '{' || char === '}') return null
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') {
      if (depth === 0) return null
      depth--
    } else if (char === ';' && depth === 0) {
      declarations.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (quote || depth) return null
  declarations.push(current)
  return declarations
}

/**
 * Returns the allowed part of `style` for `tagName` in sanitize-html's
 * stringified form, or '' when nothing survives.
 */
export function filterRichTextStyle(tagName: string, style: string | null | undefined): string {
  if (!style) return ''
  const declarations = splitDeclarations(style)
  if (!declarations) return ''
  const rules: StyleRules = { ...RICH_TEXT_ALLOWED_STYLES['*'], ...RICH_TEXT_ALLOWED_STYLES[tagName] }
  const kept: string[] = []
  for (const declaration of declarations) {
    if (!declaration.trim()) continue
    const colon = declaration.indexOf(':')
    if (colon === -1) return ''
    const prop = declaration.slice(0, colon).trim()
    let value = declaration.slice(colon + 1).trim()
    const important = IMPORTANT_RE.test(value)
    if (important) value = value.replace(IMPORTANT_RE, '')
    const allowed = Object.prototype.hasOwnProperty.call(rules, prop) ? rules[prop] : null
    if (!allowed?.some((re) => re.test(value))) continue
    kept.push(`${prop}:${value}${important ? ' !important' : ''}`)
  }
  return kept.join(';')
}

/**
 * sanitize-html `transformTags['*']`: runs after the tag-specific transforms,
 * with the final tag name, and keeps only the allowed part of `style`.
 */
export function transformRichTextStyle(tagName: string, attribs: Attributes): { tagName: string; attribs: Attributes } {
  if (!('style' in attribs)) return { tagName, attribs }
  const style = filterRichTextStyle(tagName, attribs.style)
  const result: Attributes = { ...attribs }
  if (style) result.style = style
  else delete result.style
  return { tagName, attribs: result }
}
