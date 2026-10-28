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
    const { getByTestId, getByText, queryByTestId } = await render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={onNavigate} />
    )

    expect(getByText('Раздел')).toBeTruthy()
    expect(getByText('Галерея')).toBeTruthy()

    await fireEvent.press(getByTestId('travel-sections-trigger'))
    expect(getByTestId('travel-sections-sheet')).toBeTruthy()
    expect(getByText('Основное')).toBeTruthy()
    expect(getByText('Маршрут')).toBeTruthy()

    await fireEvent.press(getByTestId('travel-sections-item-map'))

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('map')
      expect(queryByTestId('travel-sections-sheet')).toBeNull()
    })
  })

  it('opens on a header request and does not re-open itself on a later mount', async () => {
    const first = await render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )
    expect(first.queryByTestId('travel-sections-sheet')).toBeNull()

    await act(() => {
      useTravelSectionsStore.getState().requestOpen()
    })
    expect(first.getByTestId('travel-sections-sheet')).toBeTruthy()
    expect(useTravelSectionsStore.getState().pendingOpen).toBe(false)

    // Следующая статья: шит монтируется заново, запрос уже обработан — меню
    // должно остаться закрытым (иначе оно открывается сразу при входе).
    await first.unmount()
    const next = await render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )
    expect(next.queryByTestId('travel-sections-sheet')).toBeNull()
  })

  it('honours a request made before it mounted', async () => {
    await act(() => {
      useTravelSectionsStore.getState().requestOpen()
    })

    const { getByTestId } = await render(
      <TravelSectionsSheet links={links} activeSection="gallery" onNavigate={jest.fn()} />
    )

    expect(getByTestId('travel-sections-sheet')).toBeTruthy()
  })
})
