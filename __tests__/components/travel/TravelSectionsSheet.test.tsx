import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'

describe('TravelSectionsSheet', () => {
  const links = [
    { key: 'gallery', label: 'Галерея', icon: 'photo' },
    { key: 'map', label: 'Карта', icon: 'map', meta: '3' },
  ]

  it('opens the sheet and navigates to a section', async () => {
    const onNavigate = jest.fn()
    const { getByTestId, queryByTestId } = render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={onNavigate} />
    )

    fireEvent.press(getByTestId('travel-sections-trigger'))
    expect(getByTestId('travel-sections-sheet')).toBeTruthy()

    fireEvent.press(getByTestId('travel-sections-item-map'))

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('map')
      expect(queryByTestId('travel-sections-sheet')).toBeNull()
    })
  })
})
