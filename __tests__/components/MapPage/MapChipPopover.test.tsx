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
})
