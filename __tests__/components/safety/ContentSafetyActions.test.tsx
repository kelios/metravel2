// #2133: общий слой жалобы на контент — меню, причина, тост со сроком 24 ч, «Скрыть».

import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; userId: string }) => unknown) =>
    selector({ isAuthenticated: true, userId: '1' }),
}))

jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 5, due_at: '2026-10-05T10:00:00Z' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() => Promise.resolve([{ key: 'spam', label: 'Спам' }])),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))

jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn(() => Promise.resolve(true)) }))

import ContentSafetyActions from '@/components/safety/ContentSafetyActions'
import HiddenContentGate from '@/components/safety/HiddenContentGate'
import { reportContent, blockUser } from '@/api/userSafety'
import { showToast } from '@/utils/toast'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'
import type { ContentRef } from '@/types/contentSafety'

const mockedReport = reportContent as jest.Mock
const mockedBlock = blockUser as jest.Mock
const mockedToast = showToast as jest.Mock

const foreignComment: ContentRef = { content_type: 'travel_comment', object_id: 15, author_id: 42 }

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ContentSafetyActions (#2133)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    useHiddenContentStore.setState({ byOwner: {} })
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('renders nothing on own content', () => {
    const { queryByTestId } = renderWithClient(
      <ContentSafetyActions contentRef={{ ...foreignComment, author_id: 1 }} />,
    )
    expect(queryByTestId('content-safety-menu')).toBeNull()
  })

  it('renders nothing for an unsaved object', () => {
    const { queryByTestId } = renderWithClient(<ContentSafetyActions contentRef={null} />)
    expect(queryByTestId('content-safety-menu')).toBeNull()
  })

  it('offers report, hide and block author, block last', () => {
    const { getByTestId, getAllByRole } = renderWithClient(
      <HiddenContentGate contentRef={foreignComment}>
        <ContentSafetyActions contentRef={foreignComment} />
      </HiddenContentGate>,
    )
    fireEvent.press(getByTestId('content-safety-menu'))

    const labels = getAllByRole('button').map((node) => node.props.accessibilityLabel)
    const report = labels.indexOf('Пожаловаться')
    const hide = labels.indexOf('Скрыть у себя')
    const block = labels.indexOf('Заблокировать автора')
    expect(report).toBeGreaterThan(-1)
    expect(hide).toBeGreaterThan(report)
    expect(block).toBeGreaterThan(hide)
  })

  it('has no block item when the backend sends no author id', () => {
    const { getByTestId, queryByTestId } = renderWithClient(
      <ContentSafetyActions contentRef={{ content_type: 'quest_review', object_id: 3, author_id: null }} />,
    )
    fireEvent.press(getByTestId('content-safety-menu'))
    expect(getByTestId('content-safety-report')).toBeTruthy()
    expect(queryByTestId('content-safety-block')).toBeNull()
  })

  it('does not offer hide on a non-hideable type', () => {
    const { getByTestId, queryByTestId } = renderWithClient(
      <ContentSafetyActions contentRef={{ content_type: 'photo', object_id: 9, author_id: 42 }} />,
    )
    fireEvent.press(getByTestId('content-safety-menu'))
    expect(queryByTestId('content-safety-hide')).toBeNull()
  })

  it('sends the report for the content ref and confirms the 24 hour review', async () => {
    const { getByTestId, findByTestId } = renderWithClient(<ContentSafetyActions contentRef={foreignComment} />)
    fireEvent.press(getByTestId('content-safety-menu'))
    fireEvent.press(getByTestId('content-safety-report'))

    fireEvent.press(await findByTestId('report-reason-spam'))
    fireEvent.press(getByTestId('report-submit'))

    await waitFor(() => expect(mockedReport).toHaveBeenCalled())
    expect(mockedReport.mock.calls[0][0]).toEqual({ target: foreignComment, reason: 'spam', comment: '' })
    await waitFor(() =>
      expect(mockedToast).toHaveBeenCalledWith(
        expect.objectContaining({ text1: 'Жалоба отправлена', text2: expect.stringContaining('24') }),
      ),
    )
  })

  it('does not carry the reported state to another object in the same slot', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const ui = (ref: ContentRef) => (
      <QueryClientProvider client={queryClient}>
        <ContentSafetyActions contentRef={ref} />
      </QueryClientProvider>
    )
    const { getByTestId, findByTestId, rerender } = render(ui(foreignComment))
    fireEvent.press(getByTestId('content-safety-menu'))
    fireEvent.press(getByTestId('content-safety-report'))
    fireEvent.press(await findByTestId('report-reason-spam'))
    fireEvent.press(getByTestId('report-submit'))
    await waitFor(() => expect(mockedToast).toHaveBeenCalled())
    fireEvent.press(getByTestId('content-safety-menu'))
    expect(getByTestId('content-safety-report').props.accessibilityLabel).toBe('Жалоба отправлена')

    // Слот FlashList / следующий слайд галереи: тот же экземпляр, другой объект.
    rerender(ui({ ...foreignComment, object_id: 16 }))
    fireEvent.press(getByTestId('content-safety-menu'))
    expect(getByTestId('content-safety-report').props.accessibilityLabel).toBe('Пожаловаться')
  })

  it('blocks the author after confirmation', async () => {
    const { getByTestId } = renderWithClient(<ContentSafetyActions contentRef={foreignComment} authorName="Иван" />)
    fireEvent.press(getByTestId('content-safety-menu'))
    fireEvent.press(getByTestId('content-safety-block'))
    await waitFor(() => expect(mockedBlock).toHaveBeenCalled())
    expect(mockedBlock.mock.calls[0][0]).toBe(42)
  })

  it('offers no hide outside a list gate, where the object would stay on screen', () => {
    const { getByTestId, queryByTestId } = renderWithClient(<ContentSafetyActions contentRef={foreignComment} />)
    fireEvent.press(getByTestId('content-safety-menu'))
    expect(getByTestId('content-safety-report')).toBeTruthy()
    expect(queryByTestId('content-safety-hide')).toBeNull()
  })

  it('hides the object for the current owner and shows it back from the placeholder', async () => {
    const { getByTestId, queryByText, getByText } = renderWithClient(
      <HiddenContentGate contentRef={foreignComment}>
        <ContentSafetyActions contentRef={foreignComment} />
      </HiddenContentGate>,
    )
    fireEvent.press(getByTestId('content-safety-menu'))
    await act(async () => {
      fireEvent.press(getByTestId('content-safety-hide'))
    })

    expect(useHiddenContentStore.getState().byOwner['1']).toEqual(['travel_comment:15'])
    expect(getByText('Вы скрыли этот материал')).toBeTruthy()
    expect(mockedToast).toHaveBeenCalledWith(expect.objectContaining({ action: expect.any(Object) }))

    await act(async () => {
      fireEvent.press(getByTestId('hidden-content-show'))
    })
    expect(queryByText('Вы скрыли этот материал')).toBeNull()
  })
})
