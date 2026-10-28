import React from 'react'
import { Platform, Text, View } from 'react-native'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Keep the library's real ref registry and useToast state. Only replace its
// animated presentation, which cannot prove UIKit stacking in a unit test.
jest.unmock('react-native-toast-message')
jest.mock('react-native-toast-message/lib/src/ToastUI', () => ({
  ToastUI: ({ isVisible, data }: { isVisible: boolean; data: { text1?: string; text2?: string } }) => {
    const React = require('react')
    const { Text, View } = require('react-native')
    return isVisible ? React.createElement(View, { testID: 'toast-message' },
      React.createElement(Text, null, data.text1), React.createElement(Text, null, data.text2)) : null
  },
}))
jest.mock('@/utils/toast', () => jest.requireActual('@/utils/toast.native'))
jest.mock('@/api/userSafety', () => ({
  reportContent: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  fetchReportReasons: jest.fn(async () => [{ key: 'spam', label: 'Спам' }]),
  fetchBlockedUsers: jest.fn(async () => []),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ isAuthenticated: true, userId: '7' }),
}))
jest.mock('expo-navigation-bar', () => ({ setVisibilityAsync: jest.fn() }), { virtual: true })

import ModalToastHost from '@/components/ui/ModalToastHost'
import ToastHost from '@/components/ui/ToastHost'
import FullscreenGallery from '@/components/travel/FullscreenGallery'
import QuestModalSheet from '@/components/quests/QuestModalSheet'
import ContentSafetyActions from '@/components/safety/ContentSafetyActions'
import { reportContent } from '@/api/userSafety'
import { showToast } from '@/utils/toast.native'

const mockReport = reportContent as jest.Mock
const originalOS = Platform.OS
const mockModalInstances = new Map<object, Record<string, any>>()
const mockReportSheetProps = jest.fn()
// The setup has already cached react-native. Replace its public export so
// imported consumers use this call-through boundary during each test.
const mockReactNative = require('react-native')
const mockNativeModal = mockReactNative.Modal
const CapturedModal = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  const identity = React.useRef({})
  mockModalInstances.set(identity.current, props)
  React.useEffect(() => () => { mockModalInstances.delete(identity.current) }, [])
  return React.createElement(mockNativeModal, { ...props, ref })
})
jest.mock('@/components/safety/ReportReasonSheet', () => {
  const actual = jest.requireActual('@/components/safety/ReportReasonSheet')
  const React = require('react')
  return { ...actual, __esModule: true, default: (props: Record<string, unknown>) => {
    mockReportSheetProps(props)
    return React.createElement(actual.default, props)
  } }
})
const reportSheetVisible = () => mockReportSheetProps.mock.calls.at(-1)?.[0].visible

beforeEach(() => {
  mockModalInstances.clear()
  jest.spyOn(mockReactNative, 'Modal').mockImplementation((props: Record<string, unknown>) =>
      React.createElement(CapturedModal, props))
  jest.clearAllMocks()
  mockReport.mockReset()
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
})
afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
})

it.each(['ios', 'android'])('%s: registers only while visible and returns subsequent feedback to the root on close', async (os) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  const ui = (visible: boolean) => <>
    <View testID="root"><ToastHost /></View>
    <View testID="modal"><ModalToastHost visible={visible} /></View>
  </>
  const result = await render(ui(false))
  expect(result.getAllByTestId('toast-layer')).toHaveLength(1)
  await result.rerender(ui(true))
  await act(async () => { await showToast({ text1: 'inside', type: 'success' }) })
  expect(within(result.getByTestId('modal')).getByText('inside')).toBeTruthy()
  expect(within(result.getByTestId('root')).queryByText('inside')).toBeNull()

  await result.rerender(ui(false))
  expect(result.getAllByTestId('toast-layer')).toHaveLength(1)
  await act(async () => { await showToast({ text1: 'outside', type: 'error' }) })
  expect(within(result.getByTestId('root')).getByText('outside')).toBeTruthy()
  await result.rerender(ui(true))
  await act(async () => { await showToast({ text1: 'reopened', type: 'info' }) })
  expect(within(result.getByTestId('modal')).getByText('reopened')).toBeTruthy()
})

it('registers no extra host on web even when a sheet is visible', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  const result = await render(<ModalToastHost visible />)
  expect(result.toJSON()).toBeNull()
})

describe.each(['photo', 'quest_review'] as const)('%s parent modal report feedback', (type) => {
  const prefix = type === 'photo' ? 'travel-fullscreen-gallery-safety' : 'review-safety'
  async function renderParent() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return await render(<QueryClientProvider client={client}>
      <View testID="root"><ToastHost /></View>
      {type === 'photo' ? (
        <FullscreenGallery visible onClose={jest.fn()} safetyAuthorId={42}
          images={[{ id: 11, url: 'https://example.com/photo.jpg' }]} />
      ) : (
        <QuestModalSheet visible onClose={jest.fn()} title="Reviews" closeLabel="Close" overlayLabel="Close">
          <Text>Review content</Text>
          <ContentSafetyActions testIDPrefix={prefix}
            contentRef={{ content_type: 'quest_review', object_id: 11, author_id: 42 }} />
        </QuestModalSheet>
      )}
    </QueryClientProvider>)
  }

  async function pressReportAction(result: Awaited<ReturnType<typeof render>>) {
    await fireEvent.press(result.getByTestId(`${prefix}-menu`))
    await fireEvent.press(result.getByTestId(`${prefix}-report`))
    // The shared Modal mock does not emit UIKit's dismissal callback. Model
    // the closed action sheet's real lifecycle instead of its wall-clock fallback.
    const closedActionSheet = [...mockModalInstances.values()].find(
      modal => modal.visible === false && typeof modal.onDismiss === 'function',
    )
    expect(closedActionSheet).toBeDefined()
    await act(() => { closedActionSheet!.onDismiss() })
  }

  async function submit(result: Awaited<ReturnType<typeof render>>) {
    await pressReportAction(result)
    await waitFor(() => expect(reportSheetVisible()).toBe(true))
    await fireEvent.press(await result.findByTestId('report-reason-spam'))
    await fireEvent.press(result.getByTestId('report-submit'))
  }

  it.each([
    [{ id: 1, due_at: '2026-10-14T10:00:00Z' }, 'Жалоба отправлена'],
    [{ id: 1 }, 'Вы уже пожаловались на это'],
  ])('keeps success/duplicate feedback in the parent after the reason sheet closes (%s)', async (response, text) => {
    mockReport.mockResolvedValue(response)
    const result = await renderParent()
    await submit(result)
    await waitFor(() => expect(reportSheetVisible()).toBe(false))
    expect(mockReport.mock.calls[0][0].target.content_type).toBe(type)
    const message = result.getByTestId('toast-message')
    expect(within(message).getByText(text)).toBeTruthy()
    expect(within(message).getByText(/24/)).toBeTruthy()
    expect(within(result.getByTestId('root')).queryByTestId('toast-message')).toBeNull()
    expect(result.getAllByTestId('toast-layer')).toHaveLength(2)
    await pressReportAction(result)
    await waitFor(() => expect(within(result.getByTestId('toast-message')).getByText('Вы уже пожаловались на это')).toBeTruthy())
    expect(reportSheetVisible()).toBe(false)
    expect(mockReport).toHaveBeenCalledTimes(1)
  })

  it('shows submission failure in the reason sheet and retries to parent feedback', async () => {
    mockReport.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ id: 1, due_at: '2026-10-14' })
    const result = await renderParent()
    await submit(result)
    expect(await result.findByTestId('report-error')).toBeTruthy()
    expect(result.getByTestId('report-submit').props.disabled).toBeFalsy()
    await fireEvent.press(result.getByTestId('report-submit'))
    await waitFor(() => expect(reportSheetVisible()).toBe(false))
    expect(within(result.getByTestId('toast-message')).getByText('Жалоба отправлена')).toBeTruthy()
    expect(within(result.getByTestId('root')).queryByTestId('toast-message')).toBeNull()
  })
})
