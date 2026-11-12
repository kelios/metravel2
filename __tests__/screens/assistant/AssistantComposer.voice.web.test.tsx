/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #3351: голосовой ввод в поле вопроса ассистента на настоящем react-native-web.
 * Контракт: кнопки нет в серверной разметке и без Web Speech API; после гидрации она
 * появляется без ошибок расхождения; фраза попадает в поле, но вопрос уходит только
 * по «Спросить»; сбой доступа объясняется строкой состояния. Устройство теста —
 * как в `AssistantComposer.hydration.web.test.tsx`.
 */

let createElement: typeof import('react').createElement
let useState: typeof import('react').useState
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let createRoot: typeof import('react-dom/client').createRoot
let renderToString: typeof import('react-dom/server').renderToString
let AssistantComposer: React.ComponentType<Record<string, unknown>>
let translate: (key: string, params?: Record<string, unknown>) => string
let MAX_QUESTION_LENGTH: number
let composerProps: Record<string, unknown>

const INPUT = '[data-testid="assistant-input"]'
const SEND = '[data-testid="assistant-send"]'
const VOICE = '[data-testid="assistant-voice"]'
const STATUS = '[data-testid="assistant-voice-status"]'

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

type SpeechWindow = Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]
const finalPhrase = (transcript: string) => ({ results: [{ 0: { transcript }, isFinal: true }], resultIndex: 0 })

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, useState, act } = require('react'))
  ;({ hydrateRoot, createRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ AssistantComposer } = require('@/components/screens/assistant/AssistantComposer'))
  ;({ translate } = require('@/i18n'))
  ;({ MAX_QUESTION_LENGTH } = require('@/api/aiAssist/prompt'))
  const { createAssistantStyles } = require('@/components/screens/assistant/assistantStyles')
  const colors = require('@/hooks/useTheme').getThemedColors(false)
  composerProps = {
    styles: createAssistantStyles(colors, false),
    colors,
    busy: false,
    remaining: null,
    offTopicBlocked: false,
    inputError: null,
    onStop: () => undefined,
  }
}, 60_000)

beforeEach(() => {
  FakeRecognition.instances = []
  ;(window as SpeechWindow).SpeechRecognition = FakeRecognition
})

afterEach(() => {
  delete (window as SpeechWindow).SpeechRecognition
  delete (window as SpeechWindow).webkitSpeechRecognition
})

type Probe = { drafts: string[]; sent: string[] }

/** Владелец черновика, как `AssistantScreen`. */
const owner = (probe: Probe, initialDraft: string, extra: Record<string, unknown>) =>
  function Owner() {
    const [draft, setDraft] = useState(initialDraft)
    return createElement(AssistantComposer, {
      ...composerProps,
      ...extra,
      draft,
      onChangeDraft: (value: string) => {
        probe.drafts.push(value)
        setDraft(value)
      },
      onSend: (question: string) => {
        probe.sent.push(question)
        setDraft('')
      },
    })
  }

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

async function mount({
  hydrate = false,
  draft = '',
  extra = {},
}: { hydrate?: boolean; draft?: string; extra?: Record<string, unknown> } = {}) {
  const probe: Probe = { drafts: [], sent: [] }
  const Owner = owner(probe, draft, extra)
  const container = document.createElement('div')
  document.body.appendChild(container)

  let serverHtml = ''
  if (hydrate) {
    // Сервер не знает про Web Speech API: разметка строится без него.
    const speech = (window as SpeechWindow).SpeechRecognition
    delete (window as SpeechWindow).SpeechRecognition
    serverHtml = renderToString(createElement(Owner))
    ;(window as SpeechWindow).SpeechRecognition = speech
    container.innerHTML = serverHtml
  }

  const hydrationErrors: unknown[] = []
  const consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isHydrationMessage(args)) hydrationErrors.push(args)
  })
  let root: import('react-dom/client').Root | undefined
  await act(async () => {
    if (hydrate) {
      root = hydrateRoot(container, createElement(Owner), { onRecoverableError: (error) => hydrationErrors.push(error) })
    } else {
      root = createRoot(container)
      root.render(createElement(Owner))
    }
  })
  consoleError.mockRestore()

  return {
    probe,
    serverHtml,
    hydrationErrors,
    input: () => container.querySelector<HTMLTextAreaElement>(INPUT),
    send: () => container.querySelector<HTMLButtonElement>(SEND),
    voice: () => container.querySelector<HTMLButtonElement>(VOICE),
    status: () => container.querySelector<HTMLElement>(STATUS),
    click: (element: HTMLElement | null) => act(async () => element?.click()),
    cleanup: async () => {
      await act(async () => root?.unmount())
      container.remove()
    },
  }
}

describe('AssistantComposer: голосовой ввод (#3351)', () => {
  it('в серверной разметке кнопки нет; после гидрации при SpeechRecognition она появляется без расхождений', async () => {
    const view = await mount({ hydrate: true })
    try {
      expect(view.serverHtml).toContain('assistant-input')
      expect(view.serverHtml).not.toContain('assistant-voice')
      expect(view.hydrationErrors).toEqual([])
      expect(view.voice()).not.toBeNull()
      expect(view.voice()?.disabled).toBe(false)
    } finally {
      await view.cleanup()
    }
  })

  it('без SpeechRecognition (Firefox) кнопки нет и после монтирования', async () => {
    delete (window as SpeechWindow).SpeechRecognition
    const view = await mount()
    try {
      expect(view.input()).not.toBeNull()
      expect(view.voice()).toBeNull()
    } finally {
      await view.cleanup()
    }
  })

  it('webkitSpeechRecognition (Safari/Chrome) тоже даёт кнопку', async () => {
    delete (window as SpeechWindow).SpeechRecognition
    ;(window as SpeechWindow).webkitSpeechRecognition = FakeRecognition
    const view = await mount()
    try {
      expect(view.voice()).not.toBeNull()
    } finally {
      await view.cleanup()
    }
  })

  it('нажатие запускает распознавание; фраза попадает в поле, вопрос уходит только по «Спросить»', async () => {
    const view = await mount()
    try {
      await view.click(view.voice())
      expect(latest().start).toHaveBeenCalledTimes(1)

      await act(async () => latest().onresult?.(finalPhrase('Какие квесты есть в Гродно')))
      expect(view.input()?.value).toBe('Какие квесты есть в Гродно')
      expect(view.probe.sent).toEqual([])
      expect(view.send()?.disabled).toBe(false)

      await view.click(view.send())
      expect(view.probe.sent).toEqual(['Какие квесты есть в Гродно'])
      expect(view.input()?.value).toBe('')
    } finally {
      await view.cleanup()
    }
  })

  it('busy: кнопка выключена, нажатие распознавание не запускает', async () => {
    const view = await mount({ extra: { busy: true } })
    try {
      expect(view.voice()).not.toBeNull()
      expect(view.voice()?.disabled).toBe(true)
      await view.click(view.voice())
      expect(latest().start).not.toHaveBeenCalled()
    } finally {
      await view.cleanup()
    }
  })

  it('not-allowed: строка состояния объясняет отказ в доступе к микрофону', async () => {
    const view = await mount()
    try {
      expect(view.status()).toBeNull()
      await view.click(view.voice())
      await act(async () => latest().onerror?.({ error: 'not-allowed' }))
      expect(view.status()?.textContent).toBe(translate('aiAssistStatic:ask.voiceDenied'))
      expect(view.probe.drafts).toEqual([])
    } finally {
      await view.cleanup()
    }
  })

  it('черновик из 495 знаков и длинная фраза: в поле ровно предел вопроса', async () => {
    const draft = 'а'.repeat(MAX_QUESTION_LENGTH - 5)
    const view = await mount({ draft })
    try {
      await view.click(view.voice())
      await act(async () => latest().onresult?.(finalPhrase('очень длинная фраза про Гродно')))
      expect(MAX_QUESTION_LENGTH).toBe(500)
      expect(view.input()?.value).toHaveLength(500)
      expect(view.input()?.value.startsWith(draft)).toBe(true)
    } finally {
      await view.cleanup()
    }
  })
})
