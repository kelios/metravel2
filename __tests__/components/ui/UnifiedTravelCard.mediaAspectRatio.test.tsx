/**
 * @jest-environment jsdom
 */

// #1487: медиа-бокс карточки маршрута обязан жить на пропорциях обложки, а не
// на фиксированной высоте — иначе `contain` снова оставит плоские поля.
// Ловушка, из-за которой правка не работала с первого раза: `styles.imageContainer`
// сам задаёт `height`, а ветка фиксированной высоты — ещё и `maxHeight`; оба
// зажимают `aspectRatio` обратно в прежний ландшафтный бокс. Тест фиксирует
// именно это, и одинаково для web и native — платформенной ветки тут нет.

import React from 'react'
import renderer from 'react-test-renderer'
import { Platform, StyleSheet } from 'react-native'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'

const mockImageCardMedia: jest.Mock<any, any> = jest.fn((props: any) =>
  React.createElement('mock-image-card-media', props)
)
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  prefetchImage: () => Promise.resolve(),
}))

const renderCard = (extraProps: Record<string, unknown>) => {
  let tree: renderer.ReactTestRenderer | null = null
  renderer.act(() => {
    tree = renderer.create(
      <UnifiedTravelCard
        title="Test travel"
        imageUrl="https://example.com/photo.jpg"
        onPress={() => {}}
        {...extraProps}
      />
    )
  })
  return tree as unknown as renderer.ReactTestRenderer
}

describe('#1487 пропорции медиа-бокса UnifiedTravelCard', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    Platform.OS = originalPlatform
    mockImageCardMedia.mockClear()
  })

  // Медиа-бокс — единственный узел карточки с `accessible={false}` и
  // `importantForAccessibility="no"`; по стилю его искать нельзя, стиль и есть
  // предмет проверки.
  const findMediaStyle = (tree: renderer.ReactTestRenderer) => {
    const node = tree.root.findAll(
      (candidate) =>
        candidate.props?.accessible === false &&
        candidate.props?.importantForAccessibility === 'no' &&
        candidate.props?.style != null,
      { deep: true },
    )[0]
    return node ? (StyleSheet.flatten(node.props.style) as Record<string, unknown>) : null
  }

  it.each(['web', 'ios', 'android'] as const)(
    'на %s бокс получает aspectRatio и сбрасывает фиксированную высоту',
    (platform) => {
      Platform.OS = platform as typeof Platform.OS
      const tree = renderCard({ imageHeight: 270, mediaAspectRatio: 1, width: 386 })
      const style = findMediaStyle(tree)

      expect(style?.aspectRatio).toBe(1)
      // Обе высоты обязаны уйти: `height` из базового стиля и `maxHeight` из
      // ветки фиксированной высоты.
      expect(style?.height).toBe('auto')
      expect(style?.maxHeight).toBeUndefined()
    },
  )

  it('без пропорций остаётся прежняя фиксированная высота', () => {
    Platform.OS = 'web'
    const tree = renderCard({ imageHeight: 270 })
    const style = findMediaStyle(tree)

    expect(style?.aspectRatio).toBeUndefined()
    expect(style?.height).toBe(270)
    expect(style?.maxHeight).toBe(270)
  })

  it('imageHeight={0} по-прежнему прячет медиа-бокс, пропорции его не воскрешают', () => {
    Platform.OS = 'web'
    const tree = renderCard({ imageHeight: 0, mediaAspectRatio: 1, width: 386 })
    const style = findMediaStyle(tree)

    expect(style?.display).toBe('none')
    expect(style?.aspectRatio).toBeUndefined()
  })

  it('числовая высота для оптимизатора считается из пропорций, а не из imageHeight', () => {
    Platform.OS = 'ios'
    renderCard({ imageHeight: 270, mediaAspectRatio: 0.75, width: 386 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props.height).toBe(Math.round(386 / 0.75))
  })

  it('без известной ширины карточки высота не навязывается картинке', () => {
    // Web: ширину задаёт сетка, поэтому число противоречило бы боксу.
    Platform.OS = 'web'
    renderCard({ imageHeight: 270, mediaAspectRatio: 1 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props.height).toBeUndefined()
  })
})
