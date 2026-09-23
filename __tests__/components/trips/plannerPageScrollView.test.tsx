// #2058: `[⌖]` дня на native поднимает страничный скролл экрана поездки к
// карте — `measureLayout` узла относительно содержимого ScrollView → `scrollTo`.
import React from 'react'
import { render } from '@testing-library/react-native'
import { ScrollView, type View } from 'react-native'

import PlannerPageScrollView, {
  usePlannerPageScrollTo,
} from '@/components/trips/planning/PlannerPageScrollView'

describe('PlannerPageScrollView', () => {
  it('прокручивает страницу к верху узла внутри содержимого', () => {
    let scrollToNode: ReturnType<typeof usePlannerPageScrollTo> = null
    const Probe = () => {
      scrollToNode = usePlannerPageScrollTo()
      return null
    }
    const { UNSAFE_getByType } = render(
      <PlannerPageScrollView>
        <Probe />
      </PlannerPageScrollView>,
    )
    const scrollViewNode = UNSAFE_getByType(ScrollView)
    const scrollView = scrollViewNode.instance as { scrollTo: (options: unknown) => void }
    const scrollTo = jest.spyOn(scrollView, 'scrollTo').mockImplementation(() => undefined)
    // Jest-мок ScrollView не монтирует внутренний View — ref содержимого
    // заполняется руками тем, что на устройстве отдаёт RN.
    const innerViewRef = scrollViewNode.props.innerViewRef as React.MutableRefObject<unknown>
    const inner = { tag: 'content' }
    innerViewRef.current = inner
    const node = {
      measureLayout: jest.fn((_relative: unknown, onSuccess: (x: number, y: number) => void) => onSuccess(0, 1480)),
    }

    scrollToNode?.(node as unknown as View)

    expect(node.measureLayout).toHaveBeenCalledWith(inner, expect.any(Function), expect.any(Function))
    expect(scrollTo).toHaveBeenCalledWith({ y: 1480, animated: true })
  })

  it('без провайдера вход пустой — web и тесты раскладки скроллят сами', () => {
    let scrollToNode: ReturnType<typeof usePlannerPageScrollTo> | undefined
    const Probe = () => {
      scrollToNode = usePlannerPageScrollTo()
      return null
    }
    render(<Probe />)

    expect(scrollToNode).toBeNull()
  })
})
