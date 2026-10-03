/**
 * @jest-environment jsdom
 */

// #2121: экран по ссылке из письма рассылки. Четыре состояния, одноразовый
// токен — ровно один запрос на токен даже при двойном эффекте StrictMode, и
// `?status=` из редиректа бэка (#2122) без запроса.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

const mockPush = jest.fn()
let mockParams: Record<string, string | string[] | undefined> = {}
const mockResolve = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => false,
}))

jest.mock('@/api/subscriptionLinks', () => ({
  resolveSubscriptionLink: (...args: unknown[]) => mockResolve(...args),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/seo', () => ({ buildCanonicalUrl: (p: string) => `https://metravel.by${p}` }))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ background: '#fff', primaryDark: '#c50' }),
}))

// EmptyState — общий слой, здесь проверяется только то, что экран ему передаёт.
jest.mock('@/components/ui/EmptyState', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: ({ title, description, action, secondaryAction, moreActions = [] }: any) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, title),
        React.createElement(Text, null, description),
        action && React.createElement(Pressable, { onPress: action.onPress }, React.createElement(Text, null, action.label)),
        secondaryAction &&
          React.createElement(Pressable, { onPress: secondaryAction.onPress }, React.createElement(Text, null, secondaryAction.label)),
        ...moreActions.map((extra: any) =>
          React.createElement(Pressable, { key: extra.label, onPress: extra.onPress }, React.createElement(Text, null, extra.label)),
        ),
      ),
  }
})

import SubscriptionLinkResult from '@/components/subscribe/SubscriptionLinkResult'
import { translate as i18nT } from '@/i18n'

const t = (key: string) => i18nT(`sharedStatic:subscriptionLink.${key}`)

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('SubscriptionLinkResult', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockResolve.mockReset()
    mockParams = {}
  })

  it('confirm token: pending first, then confirmed after one API call; buttons navigate', async () => {
    const pending = deferred<string>()
    mockResolve.mockReturnValueOnce(pending.promise)
    mockParams = { token: 'tok-1' }

    render(<SubscriptionLinkResult action="confirm" />)
    expect(screen.getByTestId('subscription-link-pending')).toBeTruthy()

    await act(async () => pending.resolve('confirmed'))
    expect(screen.getByTestId('subscription-link-confirmed')).toBeTruthy()
    expect(screen.getByText(t('confirmedTitle'))).toBeTruthy()
    expect(mockResolve).toHaveBeenCalledTimes(1)
    expect(mockResolve).toHaveBeenCalledWith('confirm', 'tok-1')

    fireEvent.press(screen.getByText(t('toQuests')))
    fireEvent.press(screen.getByText(t('toHome')))
    expect(mockPush.mock.calls).toEqual([['/quests'], ['/']])
  })

  it('StrictMode double effect spends the token once and still shows the result', async () => {
    mockResolve.mockResolvedValue('unsubscribed')
    mockParams = { token: 'tok-2' }

    render(
      <React.StrictMode>
        <SubscriptionLinkResult action="unsubscribe" />
      </React.StrictMode>,
    )

    await waitFor(() => expect(screen.getByTestId('subscription-link-unsubscribed')).toBeTruthy())
    expect(mockResolve).toHaveBeenCalledTimes(1)
    expect(screen.getByText(t('unsubscribedTitle'))).toBeTruthy()
  })

  it('invalid token shows the action-specific invalid copy', async () => {
    mockResolve.mockResolvedValue('invalid')
    mockParams = { token: 'used' }

    render(<SubscriptionLinkResult action="unsubscribe" />)

    await waitFor(() => expect(screen.getByTestId('subscription-link-invalid')).toBeTruthy())
    expect(screen.getByText(t('invalidTitle'))).toBeTruthy()
    expect(screen.getByText(t('invalidUnsubscribeText'))).toBeTruthy()
  })

  it('network error shows retry; retry calls the API again and can succeed', async () => {
    mockResolve.mockResolvedValueOnce('error').mockResolvedValueOnce('confirmed')
    mockParams = { token: 'tok-3' }

    render(<SubscriptionLinkResult action="confirm" />)

    await waitFor(() => expect(screen.getByTestId('subscription-link-error')).toBeTruthy())
    expect(screen.queryByText(t('invalidTitle'))).toBeNull()
    expect(screen.getByText(t('toQuests'))).toBeTruthy()
    expect(screen.getByText(t('toHome'))).toBeTruthy()

    fireEvent.press(screen.getByText(t('retry')))
    await waitFor(() => expect(screen.getByTestId('subscription-link-confirmed')).toBeTruthy())
    expect(mockResolve).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['confirmed', 'subscription-link-confirmed'],
    ['unsubscribed', 'subscription-link-unsubscribed'],
    ['invalid', 'subscription-link-invalid'],
    ['something-else', 'subscription-link-invalid'],
  ])('?status=%s renders its state without an API call', async (status, testID) => {
    mockParams = { status, token: 'already-spent' }

    render(<SubscriptionLinkResult action="confirm" />)

    await waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy())
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('no token and no status → invalid without a request', async () => {
    render(<SubscriptionLinkResult action="confirm" />)

    await waitFor(() => expect(screen.getByTestId('subscription-link-invalid')).toBeTruthy())
    expect(screen.getByText(t('invalidConfirmText'))).toBeTruthy()
    expect(mockResolve).not.toHaveBeenCalled()
  })
})
