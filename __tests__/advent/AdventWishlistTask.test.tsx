import { fireEvent, render, waitFor } from '@testing-library/react-native'

import AdventWishlistTask from '@/components/advent/tasks/AdventWishlistTask'
import type { AdventWishlistGame } from '@/types/advent'

const mockLoad = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()
const mockStatuses = jest.fn()

jest.mock('@/context/AuthContext', () => ({
  useAuth: (select: (auth: { userId: string | null }) => unknown) => select({ userId: 'u1' }),
}))

jest.mock('@/stores/travelStatusStore', () => ({
  loadTravelStatus: (...args: unknown[]) => mockLoad(...args),
  setTravelStatus: (...args: unknown[]) => mockSet(...args),
  removeTravelStatus: (...args: unknown[]) => mockRemove(...args),
  useTravelStatus: () => mockStatuses(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: Record<string, unknown>) => React.createElement(View, props)
})

const game: AdventWishlistGame = {
  kind: 'wishlist',
  goal: 1,
  places: [{ travelId: 186, title: 'Смолевуд', link: '/travels/smolevud', country: 'Беларусь' }],
}

const renderTask = () => render(<AdventWishlistTask game={game} onOpenLink={jest.fn()} />)

describe('AdventWishlistTask', () => {
  beforeEach(() => {
    mockLoad.mockReset().mockResolvedValue(true)
    mockSet.mockReset().mockResolvedValue(undefined)
    mockRemove.mockReset().mockResolvedValue(undefined)
    mockStatuses.mockReset().mockReturnValue([])
  })

  it('ставит из дверцы «Был здесь» или «Хочу поехать»', async () => {
    const screen = await renderTask()
    await waitFor(() => expect(screen.getByTestId('advent-wishlist-visited-186').props.accessibilityState.disabled).toBe(false))
    expect(screen.getByText('Был здесь')).toBeTruthy()
    expect(screen.getByText('Хочу поехать')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('advent-wishlist-visited-186'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ id: 186, status: 'visited', title: 'Смолевуд', url: '/travels/smolevud' }), 'u1')

    await fireEvent.press(screen.getByTestId('advent-wishlist-toggle-186'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ id: 186, status: 'wishlist' }), 'u1')
  })

  it('не считает «Был здесь» в цель дверцы и даёт сменить его на «Хочу поехать»', async () => {
    mockStatuses.mockReturnValue([{ id: 186, status: 'visited' }])
    const screen = await renderTask()
    await waitFor(() => expect(screen.getByTestId('advent-wishlist-toggle-186').props.accessibilityState.disabled).toBe(false))
    expect(screen.getByText('Уже были')).toBeTruthy()
    expect(screen.getByText('В списке желаний: 0 из 1')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('advent-wishlist-toggle-186'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'wishlist' }), 'u1')
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('повторное нажатие снимает уже выбранный статус', async () => {
    mockStatuses.mockReturnValue([{ id: '186', status: 'wishlist' }])
    const screen = await renderTask()
    await waitFor(() => expect(screen.getByText('В списке')).toBeTruthy())
    expect(screen.getByText('В списке желаний: 1 из 1')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('advent-wishlist-toggle-186'))
    expect(mockRemove).toHaveBeenCalledWith(186, 'u1')
    expect(mockSet).not.toHaveBeenCalled()
  })
})
