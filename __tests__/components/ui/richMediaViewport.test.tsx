import React from 'react'
import { Animated, Text } from 'react-native'
import { act, render } from '@testing-library/react-native'

import {
  RichMediaViewportProvider,
  useRichMediaVisibility,
} from '@/components/ui/richMediaViewport'

function Probe() {
  const { visible } = useRichMediaVisibility(200)
  return <Text testID="probe">{visible ? 'visible' : 'hidden'}</Text>
}

describe('useRichMediaVisibility', () => {
  it('без провайдера медиа всегда монтируется (web, статьи, тесты)', () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('probe').props.children).toBe('visible')
  })

  it('под провайдером кадр вне вьюпорта скрыт, но раскрывается по fallback-таймеру', () => {
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
    jest.useRealTimers()
  })
})
