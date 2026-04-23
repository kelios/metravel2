import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'

describe('TravelSectionsSheet', () => {
  const links = [
    { key: 'gallery', label: 'Галерея', icon: 'image' },
    { key: 'map', label: 'Карта маршрута', icon: 'map', meta: '3' },
  ]

  it('shows the active section in the trigger, groups sections, and navigates', async () => {
    const onNavigate = jest.fn()
    const { getByTestId, getByText, queryByTestId } = render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={onNavigate} />
    )

    expect(getByText('Раздел')).toBeTruthy()
    expect(getByText('Галерея')).toBeTruthy()

    fireEvent.press(getByTestId('travel-sections-trigger'))
    expect(getByTestId('travel-sections-sheet')).toBeTruthy()
    expect(getByText('Основное')).toBeTruthy()
    expect(getByText('Маршрут')).toBeTruthy()

    fireEvent.press(getByTestId('travel-sections-item-map'))

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('map')
      expect(queryByTestId('travel-sections-sheet')).toBeNull()
    })
  })
})
