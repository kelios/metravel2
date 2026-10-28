import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import React from 'react'
import { Platform, ScrollView } from 'react-native'
import { act, fireEvent, render, within } from '@testing-library/react-native'
import type { TestInstance } from 'test-renderer'

import ReportReasonSheet from '@/components/safety/ReportReasonSheet'
import { REPORT_REASON_KEYS } from '@/utils/reportReasonLabel'

const mockMutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false, isError: false }
jest.mock('@/hooks/useUserSafety', () => ({
  useReportReasons: () => ({
    data: require('@/utils/reportReasonLabel').REPORT_REASON_KEYS.map((key: string) => ({ key, label: key })),
    isLoading: false,
  }),
  useReportContent: () => mockMutation,
}))

const target = { content_type: 'travel_comment' as const, object_id: 42, author_id: 7 }
const originalOS = Platform.OS

beforeEach(() => {
  Platform.OS = 'ios'
  jest.clearAllMocks()
  mockMutation.isPending = false
  mockMutation.isError = false
})
afterEach(() => { Platform.OS = originalOS })

it('exposes six reasons, the labelled comment, submit and close without a grouping pressable ancestor', async () => {
  const result = await render(<ReportReasonSheet visible target={target} onClose={jest.fn()} />)
  expect(result.getAllByRole('radio')).toHaveLength(6)
  const panel = result.getByTestId('bottom-sheet-panel')
  const comment = result.getByTestId('report-comment')
  expect(comment.props.accessibilityLabel).toBe('Комментарий (необязательно)')
  expect(within(panel).getByLabelText('Отправить жалобу')).toBeTruthy()
  expect(within(panel).getByLabelText('Закрыть')).toBeTruthy()
  for (const node of [...result.getAllByRole('radio'), comment, result.getByTestId('report-submit')]) {
    for (let parent: TestInstance | null = node.parent; parent && parent !== panel; parent = parent.parent) {
      expect(parent.props.accessibilityLabel).toBeUndefined()
      expect(parent.props.accessible).not.toBe(true)
      expect(parent.props.onPress).toBeUndefined()
    }
  }
})

it('keeps submit outside the scrolling keyboard form and sends the selected reason with bounded comment', async () => {
  const onClose = jest.fn()
  const onReported = jest.fn()
  const result = await render(<ReportReasonSheet visible target={target} onClose={onClose} onReported={onReported} />)
  const submit = result.getByTestId('report-submit')
  expect(submit.props.disabled).toBe(true)
  const body = getOnlyHost(result.container, node => node.type === "RCTScrollView")
  expect(body.props.keyboardShouldPersistTaps).toBe('handled')
  expect(within(body).queryByTestId('report-submit')).toBeNull()
  const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd').mockImplementation(() => {})
  await fireEvent(result.getByTestId('report-comment'), 'focus')
  scrollToEnd.mockClear()
  await fireEvent(body, 'layout')
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
  scrollToEnd.mockRestore()
  expect(within(result.getByTestId('bottom-sheet-keyboard-container')).getByTestId('report-submit') === submit).toBe(true)

  await fireEvent.press(result.getByTestId('report-reason-spam'))
  await fireEvent.press(result.getByTestId('report-reason-scam'))
  expect(result.getByTestId('report-reason-spam').props.accessibilityState.selected).toBe(false)
  expect(result.getByTestId('report-reason-scam').props.accessibilityState.selected).toBe(true)
  await fireEvent.changeText(result.getByTestId('report-comment'), 'x'.repeat(1005))
  await fireEvent.press(submit)
  expect(mockMutation.mutate).toHaveBeenCalledWith(
    { target, reason: 'scam', comment: 'x'.repeat(1000) },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  await act(() => mockMutation.mutate.mock.calls[0][1].onSuccess())
  expect(onReported).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(mockMutation.reset).toHaveBeenCalledTimes(1)
  expect(result.getByTestId('report-comment').props.value).toBe('')
  for (const key of REPORT_REASON_KEYS) {
    expect(result.getByTestId(`report-reason-${key}`).props.accessibilityState.selected).toBe(false)
  }
})

it('keeps failure available to accessibility and disables submission while pending', async () => {
  mockMutation.isError = true
  const result = await render(<ReportReasonSheet visible target={target} onClose={jest.fn()} />)
  expect(result.getByTestId('report-error').props.accessibilityRole).toBe('alert')
  await fireEvent.press(result.getByTestId('report-reason-spam'))
  mockMutation.isPending = true
  await result.rerender(<ReportReasonSheet visible target={target} onClose={jest.fn()} />)
  expect(result.getByTestId('report-submit').props.disabled).toBe(true)
  expect(result.getByTestId('report-submit').props.accessibilityState.disabled).toBe(true)
  // The project Pressable mock removes the host callback when disabled.
  // The host must not expose an actionable callback while pending.
  expect(result.getByTestId('report-submit').props.onPress).toBeUndefined()
  expect(mockMutation.mutate).not.toHaveBeenCalled()
})
