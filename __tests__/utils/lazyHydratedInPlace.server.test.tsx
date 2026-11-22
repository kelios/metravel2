/**
 * @jest-environment node
 */

import React, { Suspense, type ReactNode } from 'react'
import { Writable } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server.node'

import { lazyHydratedInPlace, type MaybeReadyImport } from '@/utils/lazyHydratedInPlace'

/**
 * #3370, серверный рендер. На сервере модуль экрана готов всегда, и рисовать его сразу нельзя: Fizz
 * идёт по дереву рекурсией, первый рендер экрана (с первой инициализацией его модулей) вставал поверх
 * стека всего дерева роутера — первый запрос `/assistant` к dev-серверу Metro отвечал 500
 * «Maximum call stack size exceeded». `React.lazy` бросает промис, и сервер продолжает экран отдельной
 * задачей с чистого стека; разметка та же.
 */

type Props = { label: string }

const stackDepth = () => {
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = Infinity
  try {
    return (new Error().stack ?? '').split('\n').length
  } finally {
    Error.stackTraceLimit = limit
  }
}

const Nest = ({ levels, children }: { levels: number; children: ReactNode }): ReactNode =>
  levels > 0 ? <div><Nest levels={levels - 1}>{children}</Nest></div> : children

const render = (node: ReactNode) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const sink = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(Buffer.from(chunk))
        done()
      },
      final(done) {
        resolve(Buffer.concat(chunks).toString('utf8'))
        done()
      },
    })
    const stream = renderToPipeableStream(node, { onAllReady: () => stream.pipe(sink), onError: reject })
  })

describe('lazyHydratedInPlace: серверный рендер (#3370)', () => {
  // Серверный бандл Expo исполняется без `window`; окружение jest объявляет его и в node-режиме.
  const scope = globalThis as { window?: unknown }
  const savedWindow = Object.getOwnPropertyDescriptor(scope, 'window')
  beforeAll(() => {
    delete scope.window
  })
  afterAll(() => {
    if (savedWindow) Object.defineProperty(scope, 'window', savedWindow)
  })

  it('готовый модуль рисуется отдельной задачей — не поверх стека дерева над границей, разметка содержит экран', async () => {
    expect(typeof window).toBe('undefined')
    const depths = { boundary: 0, screen: 0 }
    const Screen = ({ label }: Props) => {
      depths.screen = stackDepth()
      return <span data-testid="screen">{label}</span>
    }
    const Boundary = ({ children }: { children: ReactNode }) => {
      depths.boundary = stackDepth()
      return <Suspense fallback={<span data-testid="fallback" />}>{children}</Suspense>
    }
    const module = { default: Screen }
    const loads = jest.fn()
    const Lazy = lazyHydratedInPlace<Props>(() => {
      loads()
      // Загрузчик Expo на сервере: модуль уже исполнен, промис несёт его в `_result`.
      return Object.assign(Promise.resolve(module), { _result: module }) as MaybeReadyImport<Props>
    })

    const html = await render(
      <Nest levels={60}>
        <Boundary>
          <Lazy label="ready" />
        </Boundary>
      </Nest>,
    )

    expect(html).toContain('<span data-testid="screen">ready</span>')
    expect(html).not.toContain('data-testid="fallback"')
    expect(loads).toHaveBeenCalledTimes(1)
    // Экран нарисован с чистого стека: мельче границы, над которой 60 уровней дерева.
    expect(depths.boundary).toBeGreaterThan(60)
    expect(depths.screen).toBeLessThan(depths.boundary)
  })
})
