/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform, useWindowDimensions } from 'react-native'

// `useHydrationReady` читает `Platform.OS` при каждом рендере, но `useResponsive`
// фиксирует стартовый snapshot на уровне модуля, поэтому платформу подменяем ДО
// первого require — иначе SSR-ветка вообще не участвует в проверке.
Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
const { useQuestWizardResponsiveModel } =
  require('@/components/quests/hooks/useQuestWizardResponsiveModel') as typeof import('@/components/quests/hooks/useQuestWizardResponsiveModel')

type Frame = { screenW: number; isMobile: boolean; compactNav: boolean }

function Probe({ frames }: { frames: Frame[] }) {
  const { screenW, isMobile, compactNav } = useQuestWizardResponsiveModel()
  frames.push({ screenW, isMobile, compactNav })
  return <span>{screenW}</span>
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

// #1562: поддерево визарда квеста монтируется только после гидратации
// (`React.lazy` + `Suspense` + гейт по данным), поэтому лишний кадр с нулевой
// шириной рисовал мобильную ветку шапки — счётчик прогресса 9 px вместо 22 px и
// ленту шагов «точками» вместо пилюль с `minHeight: 44`. Следующий кадр
// перекладывал всё содержимое: CLS 0,40 на desktop-ширинах < 1280.
describe('useQuestWizardResponsiveModel (web)', () => {
  it('knows the real viewport on the very first render — no zero-width frame', async () => {
    const measured = { width: 0 }
    const windowProbe = await renderProbe(<WindowWidthProbe out={measured} />)
    await windowProbe.unmount()
    expect(measured.width).toBeGreaterThan(0)

    const frames: Frame[] = []
    const probe = await renderProbe(<Probe frames={frames} />)

    expect(frames[0].screenW).toBe(measured.width)
    // Один кадр — значит переключения ветки компоновки после первого paint нет.
    expect(frames.map((frame) => frame.screenW)).toEqual([measured.width])

    await probe.unmount()
  })

  it('never renders the mobile header branch on a desktop viewport', async () => {
    const measured = { width: 0 }
    const windowProbe = await renderProbe(<WindowWidthProbe out={measured} />)
    await windowProbe.unmount()
    expect(measured.width).toBeGreaterThanOrEqual(768)

    const frames: Frame[] = []
    const probe = await renderProbe(<Probe frames={frames} />)

    // Именно эти два флага переключали геометрию шапки между первым и вторым
    // кадром: `isMobile` — высоту счётчика, `compactNav`/`screenW < 600` — ленту.
    expect(frames.every((frame) => frame.isMobile === false)).toBe(true)
    expect(frames.every((frame) => frame.compactNav === false)).toBe(true)

    await probe.unmount()
  })
})
