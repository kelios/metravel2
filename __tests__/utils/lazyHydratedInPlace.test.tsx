/**
 * @jest-environment jsdom
 */

import React, { act, Component, Suspense, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { lazyHydratedInPlace, type MaybeReadyImport } from '@/utils/lazyHydratedInPlace'

/**
 * #3370: `_result` — внутреннее поле загрузчика Expo. Без него (другой загрузчик, native без него, обновление
 * Expo) и при сбое загрузки чанка помощник обязан вести себя как прежний `React.lazy` под `Suspense`:
 * запасной вид, затем экран или ошибка до ближайшей границы ошибок — без падения на чтении поля.
 */

type Props = { label: string }
type ScreenModule = { default: React.ComponentType<Props> }

const Screen = ({ label }: Props) => <span data-testid="screen">{label}</span>

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? <span data-testid="error">{this.state.error.message}</span> : this.props.children
  }
}

const deferred = () => {
  let resolve!: (value: ScreenModule) => void
  let reject!: (error: Error) => void
  const promise = new Promise<ScreenModule>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const mount = async (Lazy: React.ComponentType<Props>) => {
  await act(async () => {
    root.render(
      <Boundary>
        <Suspense fallback={<span data-testid="fallback" />}>
          <Lazy label="ready" />
        </Suspense>
      </Boundary>,
    )
  })
}

const shown = (testId: string) => container.querySelector(`[data-testid="${testId}"]`)

describe('lazyHydratedInPlace: откат к React.lazy (#3370)', () => {
  it('у промиса нет поля `_result` — запасной вид, затем экран', async () => {
    const gate = deferred()
    await mount(lazyHydratedInPlace<Props>(() => gate.promise as MaybeReadyImport<Props>))
    expect(shown('fallback')).not.toBeNull()
    expect(shown('screen')).toBeNull()
    await act(async () => gate.resolve({ default: Screen }))
    expect(shown('screen')?.textContent).toBe('ready')
  })

  it('`_result` без модуля (`null`, объект без `default`) — тоже прежний React.lazy', async () => {
    for (const result of [null, {}]) {
      const gate = deferred()
      const load = () => Object.assign(gate.promise, { _result: result }) as unknown as MaybeReadyImport<Props>
      await mount(lazyHydratedInPlace<Props>(load))
      expect(shown('fallback')).not.toBeNull()
      await act(async () => gate.resolve({ default: Screen }))
      expect(shown('screen')?.textContent).toBe('ready')
      await act(async () => root.render(null))
    }
  })

  it('чанк не загрузился — ошибка доходит до границы ошибок, как у React.lazy', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const gate = deferred()
      await mount(lazyHydratedInPlace<Props>(() => Object.assign(gate.promise, { _result: gate.promise })))
      expect(shown('fallback')).not.toBeNull()
      await act(async () => gate.reject(new Error('chunk failed')))
      expect(shown('error')?.textContent).toBe('chunk failed')
      expect(shown('screen')).toBeNull()
    } finally {
      consoleError.mockRestore()
    }
  })
})
