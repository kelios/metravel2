/**
 * #1643: подсчёт байтов offline-пакета шёл посимвольным циклом и стоил 23.3 мс
 * блокировки главного потока в окне boot travel-детали (прод-профиль mobile
 * CPU ×4). Быстрый путь через `TextEncoder` обязан давать ровно то же число,
 * включая суррогатные пары и одиночный суррогат, а фолбэк обязан оставаться
 * рабочим — в Hermes `TextEncoder` может отсутствовать.
 */

const SAMPLES: Array<[string, string]> = [
  ['ascii', 'plain travel package'],
  ['cyrillic', 'Тропа ведьм в Гарце: как пройти Hexenstieg'],
  ['two-byte', 'Ćma, żółw i wąż — Kraków'],
  ['three-byte', '日本語のテキスト'],
  ['emoji surrogate pair', 'маршрут 🚶‍♀️🏔️ готов'],
  ['lone high surrogate', `broken \uD800 tail`],
  ['empty', ''],
]

const referenceUtf8ByteLength = (value: string): number => {
  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x7f) bytes += 1
    else if (codePoint <= 0x7ff) bytes += 2
    else if (codePoint <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}

const loadUtf8ByteLength = (encoderCtor: unknown): ((value: string) => number) => {
  let loaded!: (value: string) => number
  const globalScope = globalThis as { TextEncoder?: unknown }
  const original = globalScope.TextEncoder
  if (encoderCtor === undefined) {
    delete globalScope.TextEncoder
  } else {
    globalScope.TextEncoder = encoderCtor
  }
  try {
    jest.isolateModules(() => {
      loaded = require('@/services/offline/byteLength').utf8ByteLength
    })
  } finally {
    if (original === undefined) delete globalScope.TextEncoder
    else globalScope.TextEncoder = original
  }
  return loaded
}

describe('services/offline/byteLength', () => {
  // Jest-окружение jsdom не всегда отдаёт глобальный TextEncoder — берём
  // настоящий из Node, чтобы быстрый путь был проверен, а не пропущен.
  const NodeTextEncoder = require('node:util').TextEncoder

  it('fast path matches the byte count of the code-point fallback', () => {
    const fast = loadUtf8ByteLength(NodeTextEncoder)
    const fallback = loadUtf8ByteLength(undefined)

    for (const [name, sample] of SAMPLES) {
      const expected = referenceUtf8ByteLength(sample)
      expect(`${name}:${fast(sample)}`).toBe(`${name}:${expected}`)
      expect(`${name}:${fallback(sample)}`).toBe(`${name}:${expected}`)
    }
  })

  it('fast path matches Buffer.byteLength for real UTF-8 semantics', () => {
    const fast = loadUtf8ByteLength(NodeTextEncoder)
    for (const [name, sample] of SAMPLES) {
      expect(`${name}:${fast(sample)}`).toBe(`${name}:${Buffer.byteLength(sample, 'utf8')}`)
    }
  })

  it('stays available when the engine has no TextEncoder', () => {
    const fallback = loadUtf8ByteLength(undefined)
    expect(fallback('Тропа')).toBe(10)
  })
})
