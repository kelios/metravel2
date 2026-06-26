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
  ])('fires sticky quick jump navigation for %s', (sectionKey, testID) => {
    const onQuickJump = jest.fn()

    const { getByTestId } = render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    fireEvent.press(getByTestId(testID))

    expect(onQuickJump).toHaveBeenCalledWith(sectionKey)
  })

  it('fires navigation for a short native touch when ScrollView cancels press', () => {
    const onQuickJump = jest.fn()

    const { getByTestId } = render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    const chip = getByTestId('travel-quick-jump-points')
    fireEvent(chip, 'touchStart', { nativeEvent: { pageX: 584, pageY: 540 } })
    fireEvent(chip, 'touchEnd', { nativeEvent: { pageX: 589, pageY: 544 } })

    expect(onQuickJump).toHaveBeenCalledTimes(1)
    expect(onQuickJump).toHaveBeenCalledWith('points')
  })

  it('does not navigate when the user swipes the horizontal quick jump row', () => {
    const onQuickJump = jest.fn()

    const { getByTestId } = render(
      <TravelHeroQuickJumps
        links={links as any}
        isMobile
        onQuickJump={onQuickJump}
        activeKey="description"
      />,
    )

    const chip = getByTestId('travel-quick-jump-points')
    fireEvent(chip, 'touchStart', { nativeEvent: { pageX: 584, pageY: 540 } })
    fireEvent(chip, 'touchEnd', { nativeEvent: { pageX: 620, pageY: 542 } })

    expect(onQuickJump).not.toHaveBeenCalled()
  })
})
