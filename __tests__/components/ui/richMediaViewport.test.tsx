import React from 'react'
import { Animated, Platform, Text } from 'react-native'
import { act, render } from '@testing-library/react-native'

import {
  RichMediaViewportProvider,
  useRichMediaVisibility,
} from '@/components/ui/richMediaViewport'
import CustomImageRenderer from '@/components/ui/CustomImageRenderer'

const mockImageCardMedia = jest.fn((_props: any) => null)

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: unknown) => mockImageCardMedia(props),
}))

function Probe() {
  const { visible } = useRichMediaVisibility(200)
  return <Text testID="probe">{visible ? 'visible' : 'hidden'}</Text>
}

describe('useRichMediaVisibility', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalPlatform
    mockImageCardMedia.mockClear()
    jest.useRealTimers()
  })

  // Регрессия прод-сборки 21 (03.09.2026): фото в описании статьи оставались
  // пустыми серыми рамками, и в logcat не было НИ ОДНОГО сетевого запроса,
  // сколько ни скролль. `Animated.event` этого экрана создан с
  // `useNativeDriver: true` (`useTravelDetailsContainerViewModel.ts:187`),
  // поэтому JS-слушатель `scrollY` на Android не получал обновлений вовсе:
  // кадр, измеренный ниже стартовой полосы, застревал скрытым навсегда.
  // Страховочный таймер не спасал — он срабатывает только при `windowY == null`,
  // а измерение проходило успешно. Здесь `scrollY` намеренно остаётся нулём:
  // проверяется, что гейт открывается по settled-смещению обычного JS-колбэка
  // (`onScrollEndDrag`/`onMomentumScrollEnd`).
  it('раскрывает кадр по settledOffsetY, когда обновления Animated не приходят', () => {
    ;(Platform as { OS: string }).OS = 'android'
    const scrollY = new Animated.Value(0)
    let captured: ReturnType<typeof useRichMediaVisibility> | null = null
    // Кадр далеко под вьюпортом, пока экран не проскроллен.
    let windowY = 4000

    const Frame = () => {
      const gate = useRichMediaVisibility(200)
      captured = gate
      // В jest ref попадает на инстанс RN-компонента, чей measureInWindow
      // координат не отдаёт (см. тест про fallback-таймер ниже), поэтому
      // измерение подменяется здесь — иначе проверять было бы нечего.
      if (!gate.ref.current) {
        gate.ref.current = {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
            cb(0, windowY, 360, 200),
        } as never
      }
      return <Text testID="frame">{gate.visible ? 'visible' : 'hidden'}</Text>
    }

    const view = render(
      <RichMediaViewportProvider scrollY={scrollY} settledOffsetY={0}>
        <Frame />
      </RichMediaViewportProvider>,
    )
    expect(view.getByTestId('frame').props.children).toBe('hidden')

    // Жест закончился — кадр приехал во вьюпорт. Ни одного события `scrollY`.
    windowY = 200
    act(() => {
      view.rerender(
        <RichMediaViewportProvider scrollY={scrollY} settledOffsetY={3800}>
          <Frame />
        </RichMediaViewportProvider>,
      )
    })

    expect(view.getByTestId('frame').props.children).toBe('visible')
    expect(captured!.visible).toBe(true)
  })

  it('без провайдера медиа всегда монтируется (web, статьи, тесты)', () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('probe').props.children).toBe('visible')
  })

  it('под провайдером кадр вне вьюпорта скрыт, но раскрывается по fallback-таймеру', () => {
    ;(Platform as { OS: string }).OS = 'android'
    jest.useFakeTimers()
    const scrollY = new Animated.Value(0)
    const { getByTestId } = render(
      <RichMediaViewportProvider scrollY={scrollY}>
        <Probe />
      </RichMediaViewportProvider>,
    )

    // measureInWindow в тестовом рендерере не отдаёт координат — страховка обязана
    // показать фото, а не оставить вечно пустую рамку.
    expect(getByTestId('probe').props.children).toBe('hidden')
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(getByTestId('probe').props.children).toBe('visible')
  })

  it('на iOS провайдер прозрачен: гейт не держит НИ ОДНО медиа пустым', () => {
    // #1696: #1666 включила гейт на всём native и вывела из-под него только фото
    // тела статьи. Плитки квестов остались гейтящимися и приехали пустыми в
    // билд 1.0.5 (6) — на симуляторе iPhone 17 секция «Квесты по этому городу и
    // рядом» показывала три пустых квадрата, и обложки появлялись только после
    // ещё одного жеста скролла. Гейт заведён под Glide, поэтому на iOS его нет
    // совсем: и `Probe` (плитка квеста, карточка точки, Instagram-эмбед), и фото
    // тела статьи монтируются сразу.
    ;(Platform as { OS: string }).OS = 'ios'
    jest.useFakeTimers()
    const scrollY = new Animated.Value(0)
    const { getByTestId } = render(
      <RichMediaViewportProvider scrollY={scrollY}>
        <Probe />
        <CustomImageRenderer
          tnode={{
            attributes: {
              src: 'https://metravel.by/travel-description-image/example.webp',
              width: '800',
              height: '450',
            },
          } as any}
          contentWidth={358}
        />
      </RichMediaViewportProvider>,
    )

    expect(getByTestId('probe').props.children).toBe('visible')
    expect(mockImageCardMedia).toHaveBeenCalledTimes(1)
  })

  it('снимает error-placeholder после успешного retry изображения', () => {
    ;(Platform as { OS: string }).OS = 'ios'
    const { getByTestId, queryByTestId } = render(
      <CustomImageRenderer
        tnode={{
          attributes: {
            src: 'https://metravel.by/travel-description-image/example.webp',
            width: '800',
            height: '450',
          },
        } as any}
        contentWidth={358}
      />,
    )

    act(() => {
      mockImageCardMedia.mock.calls.at(-1)?.[0]?.onError()
    })
    expect(getByTestId('custom-image-error-placeholder')).toBeTruthy()

    act(() => {
      mockImageCardMedia.mock.calls.at(-1)?.[0]?.onLoad()
    })
    expect(queryByTestId('custom-image-error-placeholder')).toBeNull()
  })
})
