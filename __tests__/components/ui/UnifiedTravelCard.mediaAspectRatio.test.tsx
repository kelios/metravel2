/**
 * @jest-environment jsdom
 */

// #1487: медиа-бокс карточки маршрута обязан жить на пропорциях обложки, а не
// на фиксированной высоте — иначе `contain` снова оставит плоские поля.
// Ловушка, из-за которой правка не работала с первого раза: `styles.imageContainer`
// сам задаёт `height`, а ветка фиксированной высоты — ещё и `maxHeight`; оба
// зажимают `aspectRatio` обратно в прежний ландшафтный бокс. Тест фиксирует
// именно это, и одинаково для web и native — платформенной ветки тут нет.

import React, { act } from 'react'
import * as renderer from 'test-renderer'
import { Platform, StyleSheet } from 'react-native'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
const roots = new Set<renderer.Root>()
afterEach(async () => {
  for (const root of roots) await act(() => root.unmount())
  roots.clear()
})


const mockImageCardMedia: jest.Mock<any, any> = jest.fn((props: any) =>
  React.createElement('mock-image-card-media', props)
)
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
  prefetchImage: () => Promise.resolve(),
}))

const renderCard = async (extraProps: Record<string, unknown>) => {
  let tree: renderer.Root | null = null
  await act(() => {
    tree = renderer.createRoot()
      roots.add(tree)
      tree.render(<UnifiedTravelCard
        title="Test travel"
        imageUrl="https://example.com/photo.jpg"
        onPress={() => {}}
        {...extraProps}
      />)
  })
  return tree as unknown as renderer.Root
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
  const findMediaStyle = (tree: renderer.Root) => {
    const node = tree.container.queryAll(
      (candidate) =>
        candidate.props?.accessible === false &&
        candidate.props?.importantForAccessibility === 'no' &&
        candidate.props?.style != null
    )[0]
    return node ? (StyleSheet.flatten(node.props.style) as Record<string, unknown>) : null
  }

  it.each(['web', 'ios', 'android'] as const)(
    'на %s бокс получает aspectRatio и сбрасывает фиксированную высоту',
    async (platform) => {
      Platform.OS = platform as typeof Platform.OS
      const tree = await renderCard({ imageHeight: 270, mediaAspectRatio: 1, width: 386 })
      const style = findMediaStyle(tree)

      expect(style?.aspectRatio).toBe(1)
      // Обе высоты обязаны уйти: `height` из базового стиля и `maxHeight` из
      // ветки фиксированной высоты.
      expect(style?.height).toBe('auto')
      expect(style?.maxHeight).toBeUndefined()
    },
  )

  it('без пропорций остаётся прежняя фиксированная высота', async () => {
    Platform.OS = 'web'
    const tree = await renderCard({ imageHeight: 270 })
    const style = findMediaStyle(tree)

    expect(style?.aspectRatio).toBeUndefined()
    expect(style?.height).toBe(270)
    expect(style?.maxHeight).toBe(270)
  })

  it('imageHeight={0} по-прежнему прячет медиа-бокс, пропорции его не воскрешают', async () => {
    Platform.OS = 'web'
    const tree = await renderCard({ imageHeight: 0, mediaAspectRatio: 1, width: 386 })
    const style = findMediaStyle(tree)

    expect(style?.display).toBe('none')
    expect(style?.aspectRatio).toBeUndefined()
  })

  it('при пропорциях числовая высота в ImageCardMedia не передаётся вовсе', async () => {
    Platform.OS = 'ios'
    await renderCard({ imageHeight: 270, mediaAspectRatio: 0.75, width: 386 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props.width).toBe(386)
    expect(props.height).toBeUndefined()
  })

  it('на native без ширины карточки сайзинг берётся из mediaSlotWidth', async () => {
    // Регрессия #1103: на native `width` карточки не приходит ни от одного
    // консьюмера, и раньше единственным числом был `imageHeight`. Если не отдать
    // ничего, `buildNativeSharpImageSource` вернёт null и ExpoImage потянет
    // ОРИГИНАЛ обложки вместо `?w=`. При этом `height` при пропорциях НЕ
    // передаётся: числовая высота доезжает до ExpoImage жёстким стилем поверх
    // `height:'100%'`, и при оценке слота от вьюпорта кадр съезжает и режется
    // снизу overflow'ом медиа-бокса (finding P1 прогона #3).
    Platform.OS = 'android'
    await renderCard({ imageHeight: 270, mediaAspectRatio: 1, mediaSlotWidth: 358 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props.width).toBe(358)
    expect(props.height).toBeUndefined()
    // `baseWidth = width ?? height` в buildNativeSharpImageSource обязан быть числом
    expect(props.width ?? props.height).toEqual(expect.any(Number))
  })

  it('без ширины слота и без ширины карточки сайзинг не выдумывается', async () => {
    Platform.OS = 'web'
    await renderCard({ imageHeight: 270, mediaAspectRatio: 1 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    expect(props.width).toBeUndefined()
    expect(props.height).toBeUndefined()
  })

  it('числа сайзинга не задают геометрию: бокс картинки возвращён к 100%', async () => {
    // Иначе numeric width/height ужали бы абсолютный бокс внутри слота с
    // aspectRatio — тот же дефект, что чинился height: auto у контейнера.
    Platform.OS = 'ios'
    await renderCard({ imageHeight: 270, mediaAspectRatio: 1, mediaSlotWidth: 358 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    const flat = StyleSheet.flatten(props.style) as Record<string, unknown>
    expect(flat.width).toBe('100%')
    expect(flat.height).toBe('100%')
  })

  it('без пропорций стиль картинки не переопределяет размер', async () => {
    Platform.OS = 'ios'
    await renderCard({ imageHeight: 270, width: 358 })

    const props = mockImageCardMedia.mock.calls.at(-1)?.[0]
    const flat = StyleSheet.flatten(props.style) as Record<string, unknown>
    expect(flat.width).toBeUndefined()
    expect(flat.height).toBeUndefined()
    expect(props.height).toBe(270)
  })
})


it.each([false, true])('#2482 keeps string metadata while rendering optional title/location language markup (overlay=%s)', async (heroTitleOverlay) => {
  const tree = await renderCard({ title: 'Озёра Лепельщины', metaText: 'Беларусь', heroTitleOverlay,
    renderText: (text: string) => <span lang="ru">{text}</span> });
  const parts = tree.container.queryAll(node => node.type === 'span').filter((node) => node.props.lang === 'ru');
  expect(parts.some((node) => node.props.children === 'Озёра Лепельщины')).toBe(true);
  expect(parts.some((node) => node.props.children === 'Беларусь')).toBe(true);
  expect(mockImageCardMedia.mock.calls.at(-1)?.[0].alt).toBe('Озёра Лепельщины');
});
