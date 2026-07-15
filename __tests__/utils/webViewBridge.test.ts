import {
  parseWebViewJsonObject,
  serializeForInlineScript,
  toFiniteCoordinate,
} from '@/utils/webViewBridge'

describe('webViewBridge', () => {
  it('serializes inline data without script breakout or JS line separators', () => {
    const serialized = serializeForInlineScript({
      title: '</script><script>globalThis.pwned=true</script>',
      separators: `before${String.fromCharCode(0x2028)}middle${String.fromCharCode(0x2029)}after`,
      ampersand: 'a&b',
    })

    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('>')
    expect(serialized).not.toContain('&')
    expect(serialized).toContain('\\u003c/script\\u003e')
    expect(serialized).toContain('\\u2028')
    expect(serialized).toContain('\\u2029')
  })

  it('accepts JSON objects only and ignores executable-looking/non-object payloads', () => {
    expect(parseWebViewJsonObject('{"type":"READY"}')).toEqual({ type: 'READY' })
    expect(parseWebViewJsonObject('globalThis.pwned=true')).toBeNull()
    expect(parseWebViewJsonObject('[{"type":"READY"}]')).toBeNull()
    expect(parseWebViewJsonObject(null)).toBeNull()
  })

  it('normalizes finite coordinates and rejects out-of-range values', () => {
    expect(toFiniteCoordinate('53.9', '27.56')).toEqual({ latitude: 53.9, longitude: 27.56 })
    expect(toFiniteCoordinate(91, 27.56)).toBeNull()
    expect(toFiniteCoordinate(53.9, Number.POSITIVE_INFINITY)).toBeNull()
  })
})
