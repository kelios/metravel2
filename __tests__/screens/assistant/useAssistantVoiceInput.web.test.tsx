import { createElement } from 'react'
import { renderToString } from 'react-dom/server.node'
import { act, fireEvent, render, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { MAX_QUESTION_LENGTH } from '@/api/aiAssist/prompt'
import { AssistantVoiceButton, AssistantVoiceStatus } from '@/components/screens/assistant/AssistantVoiceButton'
import { createAssistantStyles } from '@/components/screens/assistant/assistantStyles'
import { useAssistantVoiceInput, type AssistantVoiceInputArgs } from '@/components/screens/assistant/useAssistantVoiceInput'
import { getThemedColors } from '@/hooks/useTheme'

/**
 * #3351: голосовой ввод вопроса ассистента. Web Speech API подменён управляемым
 * классом; черновик держит тест, как экран (`draft` + `onChangeDraft`).
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
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]

beforeEach(() => {
  FakeRecognition.instances = []
  setOS('web')
  ;(window as SpeechWindow).SpeechRecognition = FakeRecognition
})

afterEach(() => {
  delete (window as SpeechWindow).SpeechRecognition
  setOS(originalOS)
})

const finalPhrase = (transcript: string) => ({ results: [{ 0: { transcript }, isFinal: true }], resultIndex: 0 })
const interimPhrase = (transcript: string) => ({ results: [{ 0: { transcript }, isFinal: false }], resultIndex: 0 })

/** Владелец черновика: `onChangeDraft` перерисовывает хук с новым `draft`. */
async function mountVoice(initial: Partial<AssistantVoiceInputArgs> = {}) {
  const onChangeDraft = jest.fn()
  const availableHistory: boolean[] = []
  let props: AssistantVoiceInputArgs = { draft: '', disabled: false, onChangeDraft, ...initial }
  const view = await renderHook((p: AssistantVoiceInputArgs) => {
    const voice = useAssistantVoiceInput(p)
    availableHistory.push(voice.available)
    return voice
  }, { initialProps: props })
  onChangeDraft.mockImplementation((value: string) => {
    props = { ...props, draft: value }
    void view.rerender(props)
  })
  const rerender = async (next: Partial<AssistantVoiceInputArgs>) => {
    props = { ...props, ...next }
    await view.rerender(props)
  }
  return { ...view, onChangeDraft, availableHistory, rerender, getProps: () => props }
}

describe('useAssistantVoiceInput (#3351)', () => {
  it('на первом рендере кнопки нет, после монтирования — есть', async () => {
    const { result, availableHistory } = await mountVoice()
    expect(availableHistory[0]).toBe(false)
    expect(result.current.available).toBe(true)
  })

  it('серверный рендер не показывает кнопку (иначе гидрация разойдётся)', () => {
    function Probe() {
      const voice = useAssistantVoiceInput({ draft: '', disabled: false, onChangeDraft: () => undefined })
      return createElement('span', null, voice.available ? 'on' : 'off')
    }
    expect(renderToString(createElement(Probe))).toContain('off')
  })

  it('без SpeechRecognition кнопки нет', async () => {
    delete (window as SpeechWindow).SpeechRecognition
    const { result } = await mountVoice()
    expect(result.current.available).toBe(false)
  })

  it.each(['ios', 'android'])('на %s кнопки нет', async (os) => {
    setOS(os)
    const { result } = await mountVoice()
    expect(result.current.available).toBe(false)
  })

  it('диктовка идёт одной фразой на языке интерфейса', async () => {
    await mountVoice()
    expect(latest().continuous).toBe(false)
    expect(latest().lang).toBeTruthy()
  })

  it('фраза дописывается к актуальному черновику через один пробел, вопрос не отправляется', async () => {
    const { result, onChangeDraft, rerender } = await mountVoice()
    await act(async () => result.current.toggle())
    expect(latest().start).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(true)

    await act(async () => latest().onresult?.(interimPhrase('куда пое')))
    expect(result.current.interimText).toBe('куда пое')

    await act(async () => latest().onresult?.(finalPhrase(' Куда поехать ')))
    expect(onChangeDraft).toHaveBeenLastCalledWith('Куда поехать')

    // Посетитель допечатал руками — следующая фраза идёт к этому тексту.
    await rerender({ draft: 'Куда поехать из Минска  ' })
    await act(async () => latest().onresult?.(finalPhrase('на выходные')))
    expect(onChangeDraft).toHaveBeenLastCalledWith('Куда поехать из Минска на выходные')
    expect(onChangeDraft).toHaveBeenCalledTimes(2)
    expect(latest().stop).not.toHaveBeenCalled()
  })

  it('две фразы до перерисовки владельца не теряют первую', async () => {
    const { result, onChangeDraft } = await mountVoice({ draft: 'Минск' })
    onChangeDraft.mockImplementation(() => undefined)
    await act(async () => result.current.toggle())
    await act(async () => {
      latest().onresult?.(finalPhrase('Брест'))
      latest().onresult?.(finalPhrase('Гродно'))
    })
    expect(onChangeDraft.mock.calls.map((c) => c[0])).toEqual(['Минск Брест', 'Минск Брест Гродно'])
  })

  it('черновик обрезается до предела вопроса, запись останавливается', async () => {
    const draft = 'а'.repeat(MAX_QUESTION_LENGTH - 5)
    const { result, onChangeDraft } = await mountVoice({ draft })
    await act(async () => result.current.toggle())
    await act(async () => latest().onresult?.(finalPhrase('длинная фраза')))
    const written = onChangeDraft.mock.calls[0][0] as string
    expect(written).toHaveLength(MAX_QUESTION_LENGTH)
    expect(written).toBe(`${draft} длин`)
    expect(latest().stop).toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
  })

  it('фраза ниже предела запись не останавливает', async () => {
    const { result } = await mountVoice({ draft: 'а'.repeat(MAX_QUESTION_LENGTH - 20) })
    await act(async () => result.current.toggle())
    await act(async () => latest().onresult?.(finalPhrase('коротко')))
    expect(latest().stop).not.toHaveBeenCalled()
  })

  it('disabled во время записи останавливает её и блокирует toggle', async () => {
    const { result, rerender } = await mountVoice()
    await act(async () => result.current.toggle())
    expect(result.current.listening).toBe(true)
    await rerender({ disabled: true })
    expect(latest().stop).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(false)
    await act(async () => result.current.toggle())
    expect(latest().start).toHaveBeenCalledTimes(1)
  })

  it('фраза, которую браузер отдал после закрытия поля (disabled), в черновик не попадает', async () => {
    const { result, onChangeDraft, rerender } = await mountVoice({ draft: 'Минск' })
    await act(async () => result.current.toggle())
    await rerender({ disabled: true })
    expect(latest().stop).toHaveBeenCalledTimes(1)

    await act(async () => latest().onresult?.(finalPhrase('поздняя фраза')))
    expect(onChangeDraft).not.toHaveBeenCalled()
  })

  it('фраза, пришедшая после обычного stop() пользователя, дописывается в черновик', async () => {
    const { result, onChangeDraft } = await mountVoice({ draft: 'Минск' })
    await act(async () => result.current.toggle())
    await act(async () => result.current.toggle())
    expect(latest().stop).toHaveBeenCalledTimes(1)

    await act(async () => latest().onresult?.(finalPhrase('на выходные')))
    expect(onChangeDraft).toHaveBeenCalledTimes(1)
    expect(onChangeDraft).toHaveBeenLastCalledWith('Минск на выходные')
  })

  it('повторный toggle во время записи останавливает её', async () => {
    const { result } = await mountVoice()
    await act(async () => result.current.toggle())
    await act(async () => result.current.toggle())
    expect(latest().stop).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(false)
  })

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['audio-capture', 'denied'],
    ['language-not-supported', 'langUnsupported'],
    ['network', 'network'],
    ['no-speech', null],
    ['aborted', null],
    ['что-то новое', null],
  ])('код %s даёт notice %s; новый toggle его сбрасывает', async (code, expected) => {
    const { result } = await mountVoice()
    await act(async () => result.current.toggle())
    await act(async () => latest().onerror?.({ error: code }))
    expect(result.current.notice).toBe(expected)
    expect(result.current.listening).toBe(false)
    await act(async () => result.current.toggle())
    expect(result.current.notice).toBeNull()
    expect(result.current.listening).toBe(true)
  })
})

describe('AssistantVoiceButton / AssistantVoiceStatus (#3351)', () => {
  const colors = getThemedColors(false)
  const styles = createAssistantStyles(colors, false)

  it('кнопка нажимается и не нажимается в disabled', async () => {
    const onPress = jest.fn()
    const view = await render(<AssistantVoiceButton colors={colors} listening={false} disabled={false} onPress={onPress} />)
    await fireEvent.press(view.getByTestId('assistant-voice'))
    expect(onPress).toHaveBeenCalledTimes(1)

    await view.rerender(<AssistantVoiceButton colors={colors} listening disabled onPress={onPress} />)
    await fireEvent.press(view.getByTestId('assistant-voice'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('строки состояния нет без записи и без сбоя', async () => {
    const view = await render(<AssistantVoiceStatus styles={styles} listening={false} interimText="" notice={null} />)
    expect(view.queryByTestId('assistant-voice-status')).toBeNull()
  })

  it('во время записи строка показывает промежуточный текст, сбой — стилем ошибки', async () => {
    const view = await render(<AssistantVoiceStatus styles={styles} listening interimText="куда пое" notice={null} />)
    const listening = view.getByTestId('assistant-voice-status')
    expect(String(listening.props.children)).toMatch(/ куда пое$/)
    expect(listening.props.style).toBe(styles.composerMetaText)
    expect(listening.props.accessibilityLiveRegion).toBe('polite')

    await view.rerender(<AssistantVoiceStatus styles={styles} listening={false} interimText="" notice="denied" />)
    expect(view.getByTestId('assistant-voice-status').props.style).toBe(styles.composerErrorText)
  })
})
