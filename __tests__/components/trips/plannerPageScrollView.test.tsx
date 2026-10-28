import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
// #2058: `[⌖]` дня на native поднимает страничный скролл экрана поездки к
// карте — `measureLayout` узла относительно содержимого ScrollView → `scrollTo`.
import React from 'react'
import { render } from '@testing-library/react-native'
import { ScrollView, type View } from 'react-native'

import PlannerPageScrollView, {
  usePlannerPageScrollTo,
} from '@/components/trips/planning/PlannerPageScrollView'

describe('PlannerPageScrollView', () => {
  it('прокручивает страницу к верху узла внутри содержимого', async () => {
    let scrollToNode: ReturnType<typeof usePlannerPageScrollTo> = null
    const Probe = () => {
      scrollToNode = usePlannerPageScrollTo()
      return null
    }
    const { container: hostContainer } = await render(
      <PlannerPageScrollView>
        <Probe />
      </PlannerPageScrollView>,
    )
    const scrollViewNode = getOnlyHost(hostContainer, node => node.type === "RCTScrollView")
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined)
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
    scrollTo.mockRestore()
  })

  it('без провайдера вход пустой — web и тесты раскладки скроллят сами', async () => {
    let scrollToNode: ReturnType<typeof usePlannerPageScrollTo> | undefined
    const Probe = () => {
      scrollToNode = usePlannerPageScrollTo()
      return null
    }
    await render(<Probe />)

    expect(scrollToNode).toBeNull()
  })
})
