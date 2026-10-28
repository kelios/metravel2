import { fireEvent, render } from '@testing-library/react-native'

import TravelHeroQuickJumps from '@/components/travel/details/TravelHeroQuickJumps'

const links = [
  { key: 'map', label: 'Карта маршрута', icon: 'map' },
  { key: 'description', label: 'Описание', icon: 'file-text' },
  { key: 'points', label: 'Координаты мест', icon: 'list' },
]

describe('TravelHeroQuickJumps', () => {
  it.each([
    ['map', 'travel-quick-jump-map'],
    ['description', 'travel-quick-jump-description'],
    ['points', 'travel-quick-jump-points'],
  ])('fires sticky quick jump navigation for %s', async (sectionKey, testID) => {
    const onQuickJump = jest.fn()

    const { getByTestId } = await render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    await fireEvent.press(getByTestId(testID))

    expect(onQuickJump).toHaveBeenCalledWith(sectionKey)
  })

  it('fires navigation for a short native touch when ScrollView cancels press', async () => {
    const onQuickJump = jest.fn()

    const { getByTestId } = await render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    const chip = getByTestId('travel-quick-jump-points')
    await fireEvent(chip, 'touchStart', { nativeEvent: { pageX: 584, pageY: 540 } })
    await fireEvent(chip, 'touchEnd', { nativeEvent: { pageX: 589, pageY: 544 } })

    expect(onQuickJump).toHaveBeenCalledTimes(1)
    expect(onQuickJump).toHaveBeenCalledWith('points')
  })

  it('does not navigate when the user swipes the horizontal quick jump row', async () => {
    const onQuickJump = jest.fn()

    const { getByTestId } = await render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    const chip = getByTestId('travel-quick-jump-points')
    await fireEvent(chip, 'touchStart', { nativeEvent: { pageX: 584, pageY: 540 } })
    await fireEvent(chip, 'touchEnd', { nativeEvent: { pageX: 620, pageY: 542 } })

    expect(onQuickJump).not.toHaveBeenCalled()
  })
})
