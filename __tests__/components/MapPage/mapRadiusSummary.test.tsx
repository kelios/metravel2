import { fireEvent, render, within } from '@testing-library/react-native'

import { MapMobileRadiusPopover } from '@/components/MapPage/MapMobile/MapMobileRadiusPopover'
import { formatMapRadiusSummary } from '@/components/MapPage/MapRadiusSummary'
import { getThemedColors } from '@/constants/designSystem'

describe('Map radius summary', () => {
  it.each([
    ['default', '60 км от Минска'],
    ['geolocation', '60 км от вас'],
    ['manual', '60 км от выбранной точки'],
    ['cache', '60 км от последнего местоположения'],
  ] as const)('formats the radius for the %s anchor', (source, label) => {
    expect(formatMapRadiusSummary('60', source)).toBe(label)
  })

  it.each(['60', '60.9'])('shows the query radius once for ?radius=%s', async (radius) => {
    const onSelect = jest.fn()
    const onRequestClose = jest.fn()
    const { getByTestId } = await render(
      <MapMobileRadiusPopover
        colors={getThemedColors(false)}
        top={10}
        options={[{ id: '50', name: '50 км' }]}
        currentValue={radius}
        summary={formatMapRadiusSummary(radius, 'default')}
        onSelect={onSelect}
        onRequestClose={onRequestClose}
      />,
    )
    const popover = within(getByTestId('map-mobile-radius-popover'))

    expect(popover.getByText('60 км от Минска')).toBeTruthy()
    expect(popover.getByRole('radio', { name: '60 км', checked: true })).toBeTruthy()
    await fireEvent.press(popover.getByRole('radio', { name: '50 км', checked: false }))

    expect(onSelect).toHaveBeenCalledWith('50')
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['0.5', '0 км', '0.5'],
    ['invalid', '50 км', '50'],
  ])('selects the effective fallback option for URL radius %s', async (radius, label, optionId) => {
    const onSelect = jest.fn()
    const { getByRole } = await render(
      <MapMobileRadiusPopover
        colors={getThemedColors(false)}
        top={10}
        options={[]}
        currentValue={radius}
        onSelect={onSelect}
        onRequestClose={jest.fn()}
      />,
    )

    await fireEvent.press(getByRole('radio', { name: label, checked: true }))

    expect(onSelect).toHaveBeenCalledWith(optionId)
  })
})
