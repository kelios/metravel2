import React from 'react'
import { render, renderHook } from '@testing-library/react-native'

import AuthTermsGate, { useAuthTermsAcceptance } from '@/components/auth/AuthTermsGate'

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => {
    const { Text } = require('react-native')
    return <Text>{children}</Text>
  },
}))

// #2898: web — согласие даётся самим действием входа. Уведомление со ссылками
// вместо галки-барьера; версия условий доступна сразу и уходит только вместе с
// нажатием (обработчики форм вызывают API лишь по действию человека).
describe('AuthTermsGate consent by action (#2898)', () => {
  it('hook: consent by action is accepted from the start and carries the terms version', async () => {
    const { result } = await renderHook(() => useAuthTermsAcceptance({ consentByAction: true }))
    expect(result.current.accepted).toBe(true)
    expect(result.current.consentByAction).toBe(true)
    expect(result.current.termsVersion).toBe('1')
  })

  it('hook: default (native) still needs the explicit checkbox (#2132)', async () => {
    const { result } = await renderHook(() => useAuthTermsAcceptance())
    expect(result.current.accepted).toBe(false)
    expect(result.current.termsVersion).toBeUndefined()
  })

  it('gate: renders the notice with both documents instead of the checkbox', async () => {
    const screen = await render(<AuthTermsGate accepted consentByAction onChange={() => undefined} />)
    expect(screen.getByTestId('auth-terms-gate-notice')).toBeTruthy()
    expect(screen.queryByTestId('auth-terms-gate-checkbox')).toBeNull()
    expect(screen.getByText(/Входя или создавая аккаунт любым способом, вы принимаете/)).toBeTruthy()
    expect(screen.getByText('Пользовательское соглашение')).toBeTruthy()
    expect(screen.getByText('Правила сообщества')).toBeTruthy()
  })
})
