import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useWebSpeechDictation } from '@/hooks/useWebSpeechDictation'

/**
 * #3351: ассистенту нужен машинный код ошибки распознавания (отказ в микрофоне,
 * неподдерживаемый язык, сеть), а не только строка `error`.
 */

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = true
  interimResults = false
  start = jest.fn()
  stop = jest.fn()
  onresult: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error?: string }) => void) | null = null
  constructor() {
    FakeRecognition.instances.push(this)
  }
}

type SpeechWindow = Window & { SpeechRecognition?: unknown }

const originalOS = Platform.OS

beforeEach(() => {
  FakeRecognition.instances = []
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  ;(window as SpeechWindow).SpeechRecognition = FakeRecognition
})

afterEach(() => {
  delete (window as SpeechWindow).SpeechRecognition
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
})

const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]

describe('useWebSpeechDictation: errorCode (#3351)', () => {
  it('известный код из onerror попадает в errorCode, error сохраняет строку', async () => {
    const { result } = await renderHook(() => useWebSpeechDictation({ lang: 'ru-RU', continuous: false }))
    expect(result.current.errorCode).toBeNull()
    await act(async () => {
      result.current.start()
    })
    await act(async () => {
      latest().onerror?.({ error: 'not-allowed' })
    })
    expect(result.current.errorCode).toBe('not-allowed')
    expect(result.current.error).toBe('not-allowed')
    expect(result.current.isListening).toBe(false)
  })

  it.each(['service-not-allowed', 'language-not-supported', 'network', 'no-speech', 'aborted', 'audio-capture'])(
    'код %s передаётся как есть',
    async (code) => {
      const { result } = await renderHook(() => useWebSpeechDictation({ continuous: false }))
      await act(async () => {
        latest().onerror?.({ error: code })
      })
      expect(result.current.errorCode).toBe(code)
    },
  )

  it('неизвестная строка и отсутствие кода дают unknown', async () => {
    const { result } = await renderHook(() => useWebSpeechDictation({ continuous: false }))
    await act(async () => {
      latest().onerror?.({ error: 'bad-grammar-xyz' })
    })
    expect(result.current.errorCode).toBe('unknown')
    await act(async () => {
      latest().onerror?.({})
    })
    expect(result.current.errorCode).toBe('unknown')
  })

  it('start() сбрасывает errorCode', async () => {
    const { result } = await renderHook(() => useWebSpeechDictation({ continuous: false }))
    await act(async () => {
      latest().onerror?.({ error: 'network' })
    })
    expect(result.current.errorCode).toBe('network')
    await act(async () => {
      result.current.bindFinalTextHandler(() => undefined)
      result.current.start()
    })
    expect(result.current.errorCode).toBeNull()
    expect(result.current.isListening).toBe(true)
  })

  it('continuous: false и lang доходят до экземпляра распознавания', async () => {
    await renderHook(() => useWebSpeechDictation({ lang: 'pl-PL', continuous: false }))
    expect(FakeRecognition.instances).toHaveLength(1)
    expect(latest().continuous).toBe(false)
    expect(latest().lang).toBe('pl-PL')
    expect(latest().interimResults).toBe(true)
  })
})
