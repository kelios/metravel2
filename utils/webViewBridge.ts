const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g')
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g')

export const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseWebViewJsonObject = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isUnknownRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Serialize data embedded inside a script element without allowing `</script>` breakout.
 * A value JSON cannot represent (`undefined`, a function, a symbol) becomes the
 * `undefined` expression: `JSON.stringify` returns no string for it, and the
 * escaping chain used to throw on that instead of emitting anything (#3305).
 */
export const serializeForInlineScript = (value: unknown): string =>
  ((JSON.stringify(value) as string | undefined) ?? 'undefined')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029')

export const toFiniteNumber = (value: unknown): number | null => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export const toFiniteCoordinate = (
  latitudeValue: unknown,
  longitudeValue: unknown,
): { latitude: number; longitude: number } | null => {
  const latitude = toFiniteNumber(latitudeValue)
  const longitude = toFiniteNumber(longitudeValue)
  if (latitude == null || longitude == null) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
