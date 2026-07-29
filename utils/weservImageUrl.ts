const WESERV_HOST = 'images.weserv.nl'
const MAX_WESERV_UNWRAP_DEPTH = 16

const normalizeNestedSource = (value: string): string => {
  const trimmed = String(value || '').trim().replace(/&amp;/gi, '&')
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

/**
 * Returns the original image behind one or more nested weserv URLs.
 *
 * Legacy rich text can already contain a weserv URL. Re-sanitizing that HTML
 * used to wrap the proxy again, so a single image accumulated chains such as
 * weserv -> weserv -> ... -> S3. URLSearchParams decodes one layer per pass;
 * the bounded loop deliberately follows the chain to the real source.
 */
export const unwrapWeservImageUrl = (value: string): string => {
  const initial = String(value || '').trim().replace(/&amp;/gi, '&')
  if (!initial) return initial

  let current = initial
  const seen = new Set<string>()

  for (let depth = 0; depth < MAX_WESERV_UNWRAP_DEPTH; depth += 1) {
    let parsed: URL
    try {
      parsed = new URL(current)
    } catch {
      return current
    }

    if (parsed.hostname.toLowerCase() !== WESERV_HOST) return current

    const nested = parsed.searchParams.get('url')
    if (!nested) return current

    const next = normalizeNestedSource(nested)
    if (!next || next === current || seen.has(next)) return current

    seen.add(current)
    current = next
  }

  return current
}

export const isWeservImageUrl = (value: string): boolean => {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase() === WESERV_HOST
  } catch {
    return false
  }
}
