// __tests__/trust/SafetyNotice.test.tsx
// Trust & Safety (Sprint 16, FE-433/FE-434): показ/скрытие плашки об ответственности.

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}))

import SafetyNotice from '@/components/ui/SafetyNotice'

describe('SafetyNotice', () => {
  it('renders the default liability warning', () => {
    const { getByText } = render(<SafetyNotice />)
    expect(getByText(/MeTravel не несёт ответственности/)).toBeTruthy()
  })

  it('renders custom text', () => {
    const { getByText } = render(<SafetyNotice text="Будьте осторожны при встрече" />)
    expect(getByText('Будьте осторожны при встрече')).toBeTruthy()
  })

  it('hides itself when dismissed (with a storageKey)', () => {
    const { getByTestId, queryByTestId } = render(
      <SafetyNotice storageKey="test-notice" testID="sn" />,
    )
    expect(getByTestId('sn')).toBeTruthy()
    fireEvent.press(getByTestId('sn-dismiss'))
    expect(queryByTestId('sn')).toBeNull()
  })

  it('has no dismiss button without a storageKey', () => {
    const { queryByTestId } = render(<SafetyNotice testID="sn" />)
    expect(queryByTestId('sn-dismiss')).toBeNull()
  })
})
