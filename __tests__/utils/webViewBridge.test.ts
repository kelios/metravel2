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

  // #3264: `safeJsonString` из utils/htmlUtils удалён — его вызовы (iOS-редактор,
  // /map bootstrap) получают тот же литерал для `<`, U+2028 и U+2029.
  it('keeps the former safeJsonString output for <, U+2028 and U+2029', () => {
    const ls = String.fromCharCode(0x2028)
    const ps = String.fromCharCode(0x2029)
    const formerSafeJsonString = (value: string) =>
      JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(new RegExp(ls, 'g'), '\\u2028')
        .replace(new RegExp(ps, 'g'), '\\u2029')

    for (const value of ['<', 'a<b', `a${ls}b${ps}c`, '</script', 'https://metravel.by/api/travels/?page=1', '"quoted" \\ slash']) {
      expect(serializeForInlineScript(value)).toBe(formerSafeJsonString(value))
    }
    // `>` и `&` экранируются дополнительно; значение в WebView то же самое.
    const html = '<p style="a">R&D</p>'
    expect(serializeForInlineScript(html)).not.toBe(formerSafeJsonString(html))
    expect(JSON.parse(serializeForInlineScript(html))).toBe(html)
  })

  // #3305: `JSON.stringify(undefined)` строки не возвращает, и цепочка экранирования
  // падала с «Cannot read properties of undefined». Результат обязан быть
  // выражением JS при любом входе: одна такая ошибка в `app/+html.tsx` роняет
  // оболочку каждой страницы.
  it('emits the undefined expression for values JSON cannot represent', () => {
    for (const value of [undefined, () => 1, Symbol('s')]) {
      expect(serializeForInlineScript(value)).toBe('undefined')
    }
    // Внутри структуры поведение остаётся за JSON: ключ пропадает, элемент массива — null.
    expect(serializeForInlineScript({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(serializeForInlineScript([undefined])).toBe('[null]')
    expect(serializeForInlineScript(null)).toBe('null')
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
