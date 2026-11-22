/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #3370: экран `/assistant` стоит под `Suspense` роута и есть в статическом HTML. Пока его чанк
 * приходил после начала гидрации, первое же обновление от роута заставляло React бросить гидрацию
 * границы: статика → запасной вид → экран, поле вопроса заменялось вместе с фокусом.
 *
 * Здесь — настоящий серверный рендер react-native-web и настоящая гидрация `hydrateRoot`:
 * - `React.lazy` с модулем, который ещё не пришёл, — механизм из карточки (разметка заменяется);
 * - `lazyHydratedInPlace` с готовым модулем (`_result` загрузчика Expo: чанк уже исполнен тегом
 *   `<script>` в HTML роута) — граница гидрируется на месте: тот же узел поля, фокус и набранное;
 * - `lazyHydratedInPlace` без готового модуля — прежнее поведение, выбор компонента не меняется.
 * Роут повторяет `app/(tabs)/assistant.tsx`: `Suspense` с запасным видом и обновление после монтирования.
 */

let createElement: typeof import('react').createElement
let lazy: typeof import('react').lazy
let Suspense: typeof import('react').Suspense
let useEffect: typeof import('react').useEffect
let useState: typeof import('react').useState
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let AssistantComposer: React.ComponentType<Record<string, unknown>>
let rememberPrehydrationInput: (testID: string) => void
let lazyHydratedInPlace: typeof import('@/utils/lazyHydratedInPlace').lazyHydratedInPlace
let ASSISTANT_INPUT_TEST_ID: string
let composerProps: Record<string, unknown>

const INPUT = '[data-testid="assistant-input"]'
const FALLBACK = '[data-testid="assistant-route-fallback"]'
const TYPED = 'Куда поехать'

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, lazy, Suspense, useEffect, useState, act } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ AssistantComposer } = require('@/components/screens/assistant/AssistantComposer'))
  ;({ rememberPrehydrationInput } = require('@/hooks/usePrehydrationInputValue'))
  ;({ lazyHydratedInPlace } = require('@/utils/lazyHydratedInPlace'))
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
    onSend: () => undefined,
  }
}, 60_000)

type Probe = { drafts: string[]; screenMounts: number }
type ScreenProps = { sourceParam: string | null }
type ScreenComponent = React.ComponentType<ScreenProps>
type ScreenModule = { default: ScreenComponent }

/** Экран с черновиком, как `AssistantScreen`: пустой state, композер с полем вопроса. */
const screenOf = (probe: Probe): ScreenComponent =>
  function Screen() {
    const [draft, setDraft] = useState('')
    useEffect(() => {
      probe.screenMounts += 1
    }, [])
    return createElement(AssistantComposer, {
      ...composerProps,
      draft,
      onChangeDraft: (value: string) => {
        probe.drafts.push(value)
        setDraft(value)
      },
    })
  }

/** Роут: граница с запасным видом и обновление сверху сразу после гидрации оболочки. */
const routeOf = (Screen: ScreenComponent) =>
  function Route() {
    const [, setTick] = useState(0)
    useEffect(() => {
      setTick(1)
    }, [])
    return createElement(
      Suspense,
      { fallback: createElement('div', { 'data-testid': 'assistant-route-fallback' }) },
      createElement(Screen, { sourceParam: null }),
    )
  }

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

/** Ввод посетителя в живое поле: нативный сеттер и событие `input`, как печать с клавиатуры. */
const typeInto = (input: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function hydrateRoute(clientScreen: (screen: ScreenComponent) => ScreenComponent) {
  const probe: Probe = { drafts: [], screenMounts: 0 }
  const Screen = screenOf(probe)
  const container = document.createElement('div')
  document.body.appendChild(container)
  // Сервер рисует экран сразу: на сервере модуль экрана всегда готов.
  container.innerHTML = renderToString(createElement(routeOf(Screen)))
  const staticInput = container.querySelector<HTMLTextAreaElement>(INPUT)!
  // Посетитель ставит курсор в поле статической страницы и начинает печатать до скриптов.
  staticInput.focus()
  staticInput.value = TYPED

  let fallbackShown = false
  const observer = new MutationObserver(() => {
    if (container.querySelector(FALLBACK)) fallbackShown = true
  })
  observer.observe(container, { childList: true, subtree: true })

  const hydrationErrors: unknown[] = []
  const consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isHydrationMessage(args)) hydrationErrors.push(args)
  })
  let root: import('react-dom/client').Root | undefined
  await act(async () => {
    root = hydrateRoot(container, createElement(routeOf(clientScreen(Screen))), { onRecoverableError: (error) => hydrationErrors.push(error) })
  })
  // Записи наблюдателя доставляются микрозадачей.
  await act(async () => {
    await Promise.resolve()
  })
  consoleError.mockRestore()

  return {
    probe,
    container,
    staticInput,
    hydrationErrors,
    input: () => container.querySelector<HTMLTextAreaElement>(INPUT),
    fallbackShown: () => fallbackShown || container.querySelector(FALLBACK) !== null,
    cleanup: async () => {
      observer.disconnect()
      await act(async () => root?.unmount())
      container.remove()
    },
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('/assistant: гидрация экрана под границей роута (#3370)', () => {
  it('механизм: чанк экрана приходит после обновления сверху — React заменяет серверную разметку запасным видом, фокус потерян', async () => {
    const gate = deferred<ScreenModule>()
    let screen!: ScreenComponent
    const view = await hydrateRoute((Screen) => {
      screen = Screen
      return lazy(() => gate.promise) as unknown as ScreenComponent
    })
    try {
      // Обновление роута пришло раньше чанка: статика заменена запасным видом.
      expect(view.fallbackShown()).toBe(true)
      expect(view.container.contains(view.staticInput)).toBe(false)
      expect(view.input()).toBeNull()

      await act(async () => {
        gate.resolve({ default: screen })
      })
      // Экран нарисован заново: поле — другой узел, курсора в нём нет.
      expect(view.input()).not.toBeNull()
      expect(view.input()).not.toBe(view.staticInput)
      expect(document.activeElement).not.toBe(view.input())
    } finally {
      await view.cleanup()
    }
  })

  it('готовый модуль (`_result`): граница гидрируется на месте — тот же узел поля, фокус и набранные символы, запасного вида нет', async () => {
    const remembered = jest.fn(() => rememberPrehydrationInput(ASSISTANT_INPUT_TEST_ID))
    const loads = jest.fn()
    const view = await hydrateRoute((Screen) => {
      const module: ScreenModule = { default: Screen }
      return lazyHydratedInPlace<ScreenProps>(() => {
        loads()
        // Загрузчик Expo: все файлы чанка уже исполнены — промис несёт сам модуль.
        return Object.assign(Promise.resolve(module), { _result: module })
      }, remembered)
    })
    try {
      expect(view.hydrationErrors).toEqual([])
      expect(view.fallbackShown()).toBe(false)
      // Тот же узел: разметка не заменялась.
      expect(view.input()).toBe(view.staticInput)
      expect(document.activeElement).toBe(view.staticInput)
      // Набранное до гидрации стало черновиком (#3346) и осталось в поле.
      expect(view.probe.drafts).toEqual([TYPED])
      expect(view.staticInput.value).toBe(TYPED)
      expect(view.probe.screenMounts).toBe(1)
      expect(loads).toHaveBeenCalledTimes(1)
      expect(remembered).toHaveBeenCalledTimes(1)

      // Посетитель продолжает печатать посимвольно: каждый символ доходит до черновика, фокус на месте.
      let value = TYPED
      for (const char of ' на выходные?') {
        value += char
        await act(async () => typeInto(view.staticInput, value))
        expect(view.staticInput.value).toBe(value)
        expect(document.activeElement).toBe(view.staticInput)
      }
      expect(view.probe.drafts[view.probe.drafts.length - 1]).toBe(`${TYPED} на выходные?`)
      expect(view.probe.screenMounts).toBe(1)
      expect(view.fallbackShown()).toBe(false)
    } finally {
      await view.cleanup()
    }
  })

  it('модуль не готов: прежнее поведение с заменой разметки, набранное до гидрации всё равно переходит в новое поле; экран монтируется один раз', async () => {
    const gate = deferred<ScreenModule>()
    const remembered = jest.fn(() => rememberPrehydrationInput(ASSISTANT_INPUT_TEST_ID))
    const loads = jest.fn()
    let screen!: ScreenComponent
    const view = await hydrateRoute((Screen) => {
      screen = Screen
      return lazyHydratedInPlace<ScreenProps>(() => {
        loads()
        // Чанк ещё грузится: `_result` — тот же промис.
        return Object.assign(gate.promise, { _result: gate.promise })
      }, remembered)
    })
    try {
      expect(view.fallbackShown()).toBe(true)
      expect(view.input()).toBeNull()
      await act(async () => {
        gate.resolve({ default: screen })
      })
      expect(view.input()).not.toBe(view.staticInput)
      expect(view.input()?.value).toBe(TYPED)
      expect(view.probe.drafts).toEqual([TYPED])
      // Выбор сделан один раз: повторные рендеры роута экран не перемонтируют и чанк не перезапрашивают.
      expect(view.probe.screenMounts).toBe(1)
      expect(loads).toHaveBeenCalledTimes(1)
      expect(remembered).toHaveBeenCalledTimes(1)
    } finally {
      await view.cleanup()
    }
  })
})
