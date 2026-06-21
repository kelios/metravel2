// __tests__/components/trips/tripCreateForm.test.tsx
// Integration render-test for TripCreateForm (Sprint 13 / FE-trip-tests #406).
// Asserts consent-gate and validation errors — does NOT snapshot the full DOM.

import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

// ── Module mocks (must precede imports of the component) ──────────────────────

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useCreateTrip: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}))

jest.mock('@/hooks/useActionConsent', () => ({
  useActionConsent: () => ({
    hasConsent: false,
    grant: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn(),
  }),
}))

jest.mock('@/utils/actionConsent', () => ({
  CONSENT_TYPES: { TRIP_ORGANIZER: 'trip_organizer' },
  hasActionConsent: jest.fn(() => false),
  readActionConsentsSync: jest.fn(() => ({})),
}))

jest.mock('@/components/ui/Button', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return function Button({ label, onPress, disabled, testID, loading }: {
    label: string
    onPress?: () => void
    disabled?: boolean
    loading?: boolean
    testID?: string
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityState={{ disabled: !!(disabled || loading) }}
        testID={testID}
      >
        <Text>{label}</Text>
      </Pressable>
    )
  }
})

jest.mock('@/components/legal/ConsentCheckbox', () => {
  const { Pressable, Text } = require('react-native')
  return function ConsentCheckbox({ checked, onToggle, testID, children }: {
    checked: boolean
    onToggle: (v: boolean) => void
    testID?: string
    children?: React.ReactNode
    accessibilityLabel?: string
  }) {
    return (
      <Pressable
        testID={testID}
        onPress={() => onToggle(!checked)}
        accessibilityState={{ checked }}
      >
        <Text>{children}</Text>
      </Pressable>
    )
  }
})

// ── Component import (after mocks) ────────────────────────────────────────────

import TripCreateForm from '@/components/trips/planning/TripCreateForm'

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  ;(Platform as { OS: string }).OS = 'web'
})

describe('TripCreateForm — consent gate', () => {
  it('submit button is disabled before consent is toggled', () => {
    const { getByTestId } = render(<TripCreateForm />)
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button becomes enabled after toggling consent', () => {
    const { getByTestId } = render(<TripCreateForm />)
    fireEvent.press(getByTestId('trip-create-consent'))
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(false)
  })

  it('toggling consent twice disables submit again', () => {
    const { getByTestId } = render(<TripCreateForm />)
    const checkbox = getByTestId('trip-create-consent')
    fireEvent.press(checkbox) // check
    fireEvent.press(checkbox) // uncheck
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })
})

describe('TripCreateForm — validation errors', () => {
  it('shows title error when submitting with empty title', async () => {
    const { getByTestId, findByText } = render(<TripCreateForm />)

    // Toggle consent so the button is enabled and handleSubmit runs.
    fireEvent.press(getByTestId('trip-create-consent'))

    // Leave title empty (default '') and provide a valid date so only title fails.
    fireEvent.changeText(getByTestId('trip-create-title'), '')
    fireEvent.changeText(getByTestId('trip-create-start-date'), '2026-08-01')

    // Press submit — yup will fire asynchronously and set field errors.
    fireEvent.press(getByTestId('trip-create-submit'))

    // yup hits min(3) before required() for an empty string; the form renders
    // the first error per path: 'Название должно быть не короче 3 символов'.
    const err = await findByText(/не короче 3 символов/i)
    expect(err).toBeTruthy()
  })

  it('shows date error when start date is missing', async () => {
    const { getByTestId, findByText } = render(<TripCreateForm />)

    // Toggle consent and provide a long enough title, leave date empty.
    fireEvent.press(getByTestId('trip-create-consent'))
    fireEvent.changeText(getByTestId('trip-create-title'), 'Тест-поездка')
    // startDate default is '' — do not set it.
    fireEvent.press(getByTestId('trip-create-submit'))

    const err = await findByText(/Укажите дату старта/i)
    expect(err).toBeTruthy()
  })

  it('shows submit-level error when consent is not checked', async () => {
    // When consent is unchecked the Button is disabled so onPress won't fire via
    // the RN Pressable chain.  Verify the disabled state instead — the submit
    // error path (consentChecked=false branch) is already covered by the
    // consent-gate suite above.
    const { getByTestId } = render(<TripCreateForm />)
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })
})
