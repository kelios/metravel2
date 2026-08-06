/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform, useWindowDimensions } from 'react-native'

// `useHomeViewport` фиксирует `IS_WEB` на уровне модуля, поэтому платформу
// нужно подменить ДО его загрузки — иначе модуль считает себя native и вся
// SSR-ветка не проверяется.
Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
const { useHomeViewport } = require('@/components/home/useHomeViewport') as typeof import('@/components/home/useHomeViewport')

function Probe({ widths, clientOnly }: { widths: number[]; clientOnly?: boolean }) {
  const { width } = useHomeViewport(clientOnly ? { clientOnly: true } : undefined)
  widths.push(width)
  return <span>{width}</span>
}

function WindowWidthProbe({ out }: { out: { width: number } }) {
  out.width = useWindowDimensions().width
  return null
}

async function renderProbe(node: React.ReactElement) {
  const container = document.createElement('div')
  let root: Root | null = null
  await act(async () => {
    root = createRoot(container)
    root.render(node)
  })
  return {
    unmount: async () => {
      await act(async () => {
        root?.unmount()
      })
    },
  }
}

describe('useHomeViewport (web)', () => {
  it('defers to the SSR width on the first render so hydration matches', async () => {
    const widths: number[] = []
    const probe = await renderProbe(<Probe widths={widths} />)

    expect(widths[0]).toBe(0)
    expect(widths[widths.length - 1]).toBeGreaterThan(0)

    await probe.unmount()
  })

  // #1282: Home и HomeHero монтируются только после гидратации, поэтому лишний
  // кадр с нулевой шириной рисует узкую раскладку, а следующий кадр
  // перекладывает hero — это и есть весь CLS главной.
  it('with clientOnly knows the real width on the very first render', async () => {
    const measured = { width: 0 }
    const windowProbe = await renderProbe(<WindowWidthProbe out={measured} />)
    await windowProbe.unmount()
    expect(measured.width).toBeGreaterThan(0)

    const widths: number[] = []
    const probe = await renderProbe(<Probe widths={widths} clientOnly />)

    expect(widths[0]).toBe(measured.width)
    expect(widths).toEqual([measured.width])

    await probe.unmount()
  })
})
