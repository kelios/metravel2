import { render, fireEvent } from '@testing-library/react-native'

let mockIsSuperuser = false

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({ isSuperuser: mockIsSuperuser }),
}))

const mockMutate = jest.fn()
const mockReset = jest.fn()

jest.mock('@/hooks/useAchievementsApi', () => ({
  useRareAwardCatalog: jest.fn(() => ({
    data: [
      { slug: 'ambassador', category: 'ambassador', title: 'Амбассадор', level: 'platinum', description: 'd', ownerLimit: 50, ownersCount: 1 },
    ],
    isLoading: false,
  })),
  useGrantRareAward: jest.fn(() => ({
    mutate: mockMutate,
    reset: mockReset,
    isPending: false,
    isError: false,
    error: null,
  })),
}))

jest.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number) {
      super(String(status))
      this.status = status
    }
  },
}))

import AdminGrantRareAward from '@/components/achievements/AdminGrantRareAward'

beforeEach(() => {
  jest.clearAllMocks()
  mockIsSuperuser = false
})

describe('AdminGrantRareAward — role gating', () => {
  it('renders nothing for a non-superuser', () => {
    const { queryByLabelText } = render(<AdminGrantRareAward recipientId={42} />)
    expect(queryByLabelText('Выдать редкую награду')).toBeNull()
  })

  it('renders the grant control for a superuser', () => {
    mockIsSuperuser = true
    const { getByLabelText } = render(<AdminGrantRareAward recipientId={42} />)
    expect(getByLabelText('Выдать редкую награду')).toBeTruthy()
  })
})

describe('AdminGrantRareAward — submit', () => {
  it('grants only after a category and reason are chosen', () => {
    mockIsSuperuser = true
    const { getByLabelText } = render(
      <AdminGrantRareAward recipientId={42} recipientName="Иван" />,
    )
    // Open the sheet.
    fireEvent.press(getByLabelText('Выдать редкую награду'))
    // Pick category + fill reason.
    fireEvent.press(getByLabelText('Амбассадор'))
    fireEvent.changeText(getByLabelText('Причина выдачи награды'), 'За вклад')
    fireEvent.press(getByLabelText('Выдать награду'))
    expect(mockMutate).toHaveBeenCalledWith(
      { userId: 42, awardSlug: 'ambassador', reason: 'За вклад' },
      expect.any(Object),
    )
  })

  it('uses the selected award description when the reason field is empty', () => {
    mockIsSuperuser = true
    const { getByLabelText } = render(
      <AdminGrantRareAward recipientId={42} recipientName="Иван" />,
    )

    fireEvent.press(getByLabelText('Выдать редкую награду'))
    fireEvent.press(getByLabelText('Амбассадор'))
    fireEvent.press(getByLabelText('Выдать награду'))

    expect(mockMutate).toHaveBeenCalledWith(
      { userId: 42, awardSlug: 'ambassador', reason: 'd' },
      expect.any(Object),
    )
  })
})
