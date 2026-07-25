// Регресс на `ref={ref as any}` в components/iframe/InstagramEmbed.native.tsx.
// Каст глушил проверку типов на единственном месте, где ref реально нужен: по
// нему гейт richMediaViewport меряет положение рамки и решает, монтировать ли
// WebView. Если ref перестанет доходить до host-View, эмбеды либо не смонтируются,
// либо смонтируются все сразу — а `as any` о таком расхождении промолчал бы.
import React from 'react'
import { View } from 'react-native'

import { useRichMediaVisibility } from '@/components/ui/richMediaViewport'

const renderer = require('react-test-renderer')

type Captured = ReturnType<typeof useRichMediaVisibility>

const Frame: React.FC<{ onReady: (value: Captured) => void }> = ({ onReady }) => {
  const gate = useRichMediaVisibility(560)
  onReady(gate)
  // Ровно тот же шаблон, что в InstagramEmbed.native.tsx — без каста.
  return <View ref={gate.ref} onLayout={gate.onLayout} testID="frame" />
}

describe('useRichMediaVisibility ref contract', () => {
  it('доводит ref до host-View без каста', () => {
    let captured: Captured | null = null

    renderer.act(() => {
      renderer.create(<Frame onReady={(value) => { captured = value }} />, {
        createNodeMock: () => ({ measureInWindow: jest.fn() }),
      })
    })

    expect(captured).not.toBeNull()
    // Ref реально прикреплён к View, а не остался пустым: гейт зовёт по нему
    // measureInWindow, чтобы понять, попала ли рамка в окно монтирования.
    expect(captured!.ref.current).toBeTruthy()
    expect(typeof captured!.ref.current?.measureInWindow).toBe('function')
  })

  it('без провайдера считает медиа видимым, чтобы web и статьи не пустели', () => {
    let captured: Captured | null = null

    renderer.act(() => {
      renderer.create(<Frame onReady={(value) => { captured = value }} />, {
        createNodeMock: () => ({ measureInWindow: jest.fn() }),
      })
    })

    expect(captured!.visible).toBe(true)
  })

  it('переживает onLayout, не роняя рамку', () => {
    let captured: Captured | null = null
    let tree: any

    renderer.act(() => {
      tree = renderer.create(<Frame onReady={(value) => { captured = value }} />, {
        createNodeMock: () => ({ measureInWindow: jest.fn() }),
      })
    })

    renderer.act(() => {
      tree.root
        .findByProps({ testID: 'frame' })
        .props.onLayout({ nativeEvent: { layout: { x: 0, y: 120, width: 390, height: 560 } } })
    })

    expect(captured!.ref.current).toBeTruthy()
  })
})
