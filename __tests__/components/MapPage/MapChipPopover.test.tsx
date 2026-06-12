import React from 'react'
import * as RN from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { MapChipPopover } from '@/components/MapPage/popovers/MapChipPopover'

describe('MapChipPopover', () => {
  beforeEach(() => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    })
  })

  it('renders a clear close action for narrow filter sheets', () => {
    const onClose = jest.fn()
    const { getByLabelText, getByText } = render(
      <MapChipPopover visible={true} onClose={onClose}>
        <RN.Text>Содержимое фильтра</RN.Text>
      </MapChipPopover>,
    )

    expect(getByText('Содержимое фильтра')).toBeTruthy()

    fireEvent.press(getByLabelText('Закрыть фильтр'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sizes native sheet content to its children instead of collapsing to zero height', () => {
    // Android F-05: flex:1 (flexBasis 0) внутри контейнера с maxHeight без
    // height схлопывал контент модала (пресеты радиуса/категории) в 0px.
    const { getByTestId } = render(
      <MapChipPopover visible={true} onClose={jest.fn()}>
        <RN.Text>Пресеты радиуса</RN.Text>
      </MapChipPopover>,
    )

    const content = getByTestId('map-chip-popover-sheet-content')
    const style = RN.StyleSheet.flatten(content.props.style)

    expect(style.flex).toBeUndefined()
    expect(style.flexBasis).toBeUndefined()
    expect(style.flexShrink).toBe(1)
  })
})
