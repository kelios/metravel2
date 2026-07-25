import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'
import { useTravelSectionsStore } from '@/stores/travelSectionsStore'

describe('TravelSectionsSheet', () => {
  const links = [
    { key: 'gallery', label: 'Галерея', icon: 'image' },
    { key: 'map', label: 'Карта маршрута', icon: 'map', meta: '3' },
  ]

  beforeEach(() => {
    useTravelSectionsStore.setState({ pendingOpen: false })
  })

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

  it('opens on a header request and does not re-open itself on a later mount', () => {
    const first = render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )
    expect(first.queryByTestId('travel-sections-sheet')).toBeNull()

    act(() => {
      useTravelSectionsStore.getState().requestOpen()
    })
    expect(first.getByTestId('travel-sections-sheet')).toBeTruthy()
    expect(useTravelSectionsStore.getState().pendingOpen).toBe(false)

    // Следующая статья: шит монтируется заново, запрос уже обработан — меню
    // должно остаться закрытым (иначе оно открывается сразу при входе).
    first.unmount()
    const next = render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )
    expect(next.queryByTestId('travel-sections-sheet')).toBeNull()
  })

  it('honours a request made before it mounted', () => {
    act(() => {
      useTravelSectionsStore.getState().requestOpen()
    })

    const { getByTestId } = render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )

    expect(getByTestId('travel-sections-sheet')).toBeTruthy()
  })
})
