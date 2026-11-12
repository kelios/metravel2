/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #3346: поле вопроса `/assistant` есть в статическом HTML, и посетитель успевает
 * набрать текст до гидрации. Событий ввода React не воспроизводит, и набранное
 * терялось в обоих исходах: экран под `Suspense` с ленивым чанком React рисует
 * заново (серверная разметка удаляется вместе с полем), а в гидрированном на месте
 * поле первый повторный рендер записывает пустой state поверх текста.
 * Здесь — настоящий серверный рендер react-native-web, оба исхода и обычное
 * клиентское монтирование; владелец черновика повторяет экран (`useState('')` и
 * перерисовка эффектом после монтирования).
 */

let createElement: typeof import('react').createElement
let useEffect: typeof import('react').useEffect
let useState: typeof import('react').useState
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let createRoot: typeof import('react-dom/client').createRoot
let renderToString: typeof import('react-dom/server').renderToString
let AssistantComposer: React.ComponentType<Record<string, unknown>>
let rememberPrehydrationInput: (testID: string) => void
let ASSISTANT_INPUT_TEST_ID: string
let composerProps: Record<string, unknown>

const INPUT = '[data-testid="assistant-input"]'
const SEND = '[data-testid="assistant-send"]'
const TYPED = 'Куда поехать на выходные из Минска?'

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, useEffect, useState, act } = require('react'))
  ;({ hydrateRoot, createRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ AssistantComposer } = require('@/components/screens/assistant/AssistantComposer'))
  ;({ rememberPrehydrationInput } = require('@/hooks/usePrehydrationInputValue'))
  ;({ ASSISTANT_INPUT_TEST_ID } = require('@/utils/aiAssistantConfig'))
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

type Probe = { drafts: string[]; sent: string[] }

/** Владелец черновика, как `AssistantScreen`: пустой state и перерисовка после монтирования. */
const owner = (probe: Probe) =>
  function Owner() {
    const [draft, setDraft] = useState('')
    const [, setMounted] = useState(false)
    useEffect(() => {
      setMounted(true)
    }, [])
    return createElement(AssistantComposer, {
      ...composerProps,
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

type Outcome = 'hydrated' | 'replaced' | 'client'

/**
 * `hydrated` — разметка гидрирована на месте; `replaced` — React бросил гидрацию
 * границы и нарисовал экран заново (так ведёт себя `/assistant`: чанк экрана приходит
 * позже первого обновления); `client` — переход внутри приложения, статики нет.
 */
async function mount({ typed, outcome }: { typed: string; outcome: Outcome }) {
  const probe: Probe = { drafts: [], sent: [] }
  const Owner = owner(probe)
  const container = document.createElement('div')
  document.body.appendChild(container)

  let staticInput: HTMLTextAreaElement | null = null
  if (outcome !== 'client') {
    container.innerHTML = renderToString(createElement(Owner))
    staticInput = container.querySelector<HTMLTextAreaElement>(INPUT)
    // Посетитель печатает в статической разметке: скриптов ещё нет, событий никто не слушает.
    if (staticInput && typed) staticInput.value = typed
  }
  // Роут запоминает узел поля в фабрике `React.lazy`, пока серверная разметка цела.
  rememberPrehydrationInput(ASSISTANT_INPUT_TEST_ID)
  if (outcome === 'replaced') container.replaceChildren()

  const hydrationErrors: unknown[] = []
  const consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isHydrationMessage(args)) hydrationErrors.push(args)
  })
  let root: import('react-dom/client').Root | undefined
  await act(async () => {
    if (outcome === 'hydrated') {
      root = hydrateRoot(container, createElement(Owner), { onRecoverableError: (error) => hydrationErrors.push(error) })
    } else {
      root = createRoot(container)
      root.render(createElement(Owner))
    }
  })
  consoleError.mockRestore()

  return {
    probe,
    staticInput,
    input: container.querySelector<HTMLTextAreaElement>(INPUT),
    send: container.querySelector<HTMLButtonElement>(SEND),
    hydrationErrors,
    cleanup: async () => {
      await act(async () => root?.unmount())
      container.remove()
    },
  }
}

describe('AssistantComposer: ввод до гидрации (#3346)', () => {
  it.each<Outcome>(['replaced', 'hydrated'])(
    'набранный в статике вопрос становится черновиком, «Спросить» включена (%s)',
    async (outcome) => {
      const view = await mount({ typed: TYPED, outcome })
      try {
        expect(view.hydrationErrors).toEqual([])
        expect(view.input === view.staticInput).toBe(outcome === 'hydrated')
        expect(view.probe.drafts).toEqual([TYPED])
        expect(view.input?.value).toBe(TYPED)
        expect(view.send?.disabled).toBe(false)
        expect(view.send?.getAttribute('aria-disabled')).not.toBe('true')

        await act(async () => {
          view.send?.click()
        })
        expect(view.probe.sent).toEqual([TYPED])
        expect(view.input?.value).toBe('')
      } finally {
        await view.cleanup()
      }
    },
  )

  it.each<Outcome>(['replaced', 'hydrated', 'client'])(
    'пустое поле черновик не трогает: «Спросить» выключена (%s)',
    async (outcome) => {
      const view = await mount({ typed: '', outcome })
      try {
        expect(view.hydrationErrors).toEqual([])
        expect(view.probe.drafts).toEqual([])
        expect(view.input?.value).toBe('')
        expect(view.send?.disabled).toBe(true)
      } finally {
        await view.cleanup()
      }
    },
  )

  it('набранное отдаётся один раз: следующее монтирование поля начинает с пустого черновика', async () => {
    const first = await mount({ typed: TYPED, outcome: 'replaced' })
    await first.cleanup()
    const second = await mount({ typed: '', outcome: 'client' })
    try {
      expect(second.probe.drafts).toEqual([])
      expect(second.input?.value).toBe('')
    } finally {
      await second.cleanup()
    }
  })
})
