export function getFirstSearchParamValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return typeof value === 'string' ? value : ''
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function normalizeInternalReturnPath(value: unknown): string | null {
  const raw = getFirstSearchParamValue(value).trim()
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (raw.includes('://') || raw.includes('\\') || hasControlCharacter(raw)) {
    return null
  }
  return raw
}

export function appendReturnToParam(href: string, returnTo: unknown): string {
  const normalizedReturnTo = normalizeInternalReturnPath(returnTo)
  if (!href || !normalizedReturnTo) return href
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}returnTo=${encodeURIComponent(normalizedReturnTo)}`
}
