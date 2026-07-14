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

export const normalizeRichTextListFragments = (html: string): string => {
  if (!html) return ''

  let output = ''
  let lastIndex = 0
  let nextOrderedStart = 1
  let hasOrderedListInRun = false

  const resetListRun = () => {
    nextOrderedStart = 1
    hasOrderedListInRun = false
  }

  for (const match of html.matchAll(LIST_BLOCK_RE)) {
    const block = match[0]
    const tagName = String(match[1] || '').toLowerCase()
    const index = match.index ?? 0
    const between = html.slice(lastIndex, index)

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

  output += html.slice(lastIndex)
  return output
}
