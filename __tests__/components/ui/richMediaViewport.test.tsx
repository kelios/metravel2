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

  it('на iOS монтирует body-image сразу, сохраняя native-гейт для остальных медиа', () => {
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

    // Провайдер остаётся активным на iOS: WebView/карточки по-прежнему ленивые.
    expect(getByTestId('probe').props.children).toBe('hidden')
    // Только фото тела статьи обходит этот гейт и не остаётся пустой рамкой.
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
