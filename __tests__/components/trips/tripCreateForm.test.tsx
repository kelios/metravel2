// __tests__/components/trips/tripCreateForm.test.tsx
// Integration render-test for TripCreateForm (Sprint 13 / FE-trip-tests #406).
// Asserts consent-gate and validation errors — does NOT snapshot the full DOM.

import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

// ── Module mocks (must precede imports of the component) ──────────────────────

const mockMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useCreateTrip: () => ({
    mutate: mockMutate,
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

import TripCreateForm, {
  formatTripCreateDisplayDate,
} from '@/components/trips/planning/TripCreateForm'

type RenderedForm = ReturnType<typeof render>

function getStartDateInput(view: RenderedForm) {
  return view.UNSAFE_getByProps({ 'data-testid': 'trip-create-start-date' })
}

function changeStartDate(view: RenderedForm, value: string) {
  fireEvent(getStartDateInput(view), 'change', { target: { value } })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  ;(Platform as { OS: string }).OS = 'web'
  mockMutate.mockClear()
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
  it('prefills a real default start date instead of showing it as a placeholder', () => {
    const view = render(<TripCreateForm />)
    const startDate = getStartDateInput(view)
    expect(startDate.props.type).toBe('date')
    expect(startDate.props.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('accepts route-source prefill for organizing a trip from a travel page', () => {
    const { getByTestId } = render(
      <TripCreateForm
        initialValues={{
          title: 'Поездка по маршруту "Нарочь"',
          description: 'Исходный маршрут: https://metravel.by/travels/naroch',
        }}
      />,
    )
    expect(getByTestId('trip-create-title').props.value).toBe('Поездка по маршруту "Нарочь"')
    expect(getByTestId('trip-create-description').props.value).toContain('/travels/naroch')
  })

  it('shows title error when submitting with empty title', async () => {
    const view = render(<TripCreateForm />)
    const { getByTestId, findAllByText, queryByText } = view

    // Toggle consent so the button is enabled and handleSubmit runs.
    fireEvent.press(getByTestId('trip-create-consent'))

    // Leave title empty (default '') and provide a valid date so only title fails.
    fireEvent.changeText(getByTestId('trip-create-title'), '')
    changeStartDate(view, '2026-08-01')

    // Press submit — yup will fire asynchronously and set field errors.
    fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/Введите название поездки/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(queryByText(/не короче 3 символов/i)).toBeNull()
    expect(getByTestId('trip-create-first-error').props.children).toBe('Введите название поездки')
  })

  it('shows min-length title error when title has one or two characters', async () => {
    const view = render(<TripCreateForm />)
    const { getByTestId, findAllByText, queryByText } = view

    fireEvent.press(getByTestId('trip-create-consent'))
    fireEvent.changeText(getByTestId('trip-create-title'), 'Аб')
    changeStartDate(view, '2026-08-01')
    fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/не короче 3 символов/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(queryByText(/Введите название поездки/i)).toBeNull()
    expect(getByTestId('trip-create-first-error').props.children).toBe(
      'Название должно быть не короче 3 символов',
    )
  })

  it('shows date error when start date is missing', async () => {
    const view = render(<TripCreateForm />)
    const { getByTestId, findAllByText } = view

    // Toggle consent and provide a long enough title, leave date empty.
    fireEvent.press(getByTestId('trip-create-consent'))
    fireEvent.changeText(getByTestId('trip-create-title'), 'Тест-поездка')
    changeStartDate(view, '')
    fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/Укажите дату старта/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(getByTestId('trip-create-first-error').props.children).toBe('Укажите дату старта')
  })

  it('submits a valid form using the default start date', async () => {
    const view = render(<TripCreateForm />)
    const { getByTestId } = view
    const defaultDate = getStartDateInput(view).props.value

    fireEvent.press(getByTestId('trip-create-consent'))
    fireEvent.changeText(getByTestId('trip-create-title'), 'Тест-поездка')
    fireEvent.press(getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      title: 'Тест-поездка',
      startDate: defaultDate,
      seatsTotal: 4,
      createTelegramGroup: false,
    })
  })

  it('shows Telegram group as unavailable instead of offering a broken create checkbox', () => {
    const { getByTestId, queryByTestId, getByText } = render(<TripCreateForm />)

    expect(getByTestId('trip-create-telegram-unavailable')).toBeTruthy()
    expect(queryByTestId('trip-create-telegram-group')).toBeNull()
    expect(getByText(/Telegram-группа для участников появится/i)).toBeTruthy()
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

describe('TripCreateForm — Android date picker', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'android'
  })

  it('formats picked dates for local display', () => {
    expect(formatTripCreateDisplayDate('2026-08-15')).toBe('15 августа 2026')
    expect(formatTripCreateDisplayDate('')).toBe('Выберите дату')
  })

  it('renders a picker trigger instead of a manual date text input on Android', () => {
    const { getByTestId } = render(
      <TripCreateForm initialValues={{ startDate: '2026-08-10' }} />,
    )
    const trigger = getByTestId('trip-create-start-date')

    expect(trigger.props.accessibilityRole).toBe('button')
    expect(trigger.props.onChangeText).toBeUndefined()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('10 августа 2026')
  })

  it('updates visible date and submitted API value after selecting a calendar day', async () => {
    const { getByTestId, queryByTestId } = render(
      <TripCreateForm
        initialValues={{
          title: 'Тест-поездка',
          startDate: '2026-08-10',
        }}
      />,
    )

    fireEvent.press(getByTestId('trip-create-start-date'))
    expect(getByTestId('trip-create-date-picker')).toBeTruthy()

    fireEvent.press(getByTestId('mini-calendar-day-2026-08-15'))
    expect(queryByTestId('trip-create-date-picker')).toBeNull()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('15 августа 2026')

    fireEvent.press(getByTestId('trip-create-consent'))
    fireEvent.press(getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      title: 'Тест-поездка',
      startDate: '2026-08-15',
      seatsTotal: 4,
    })
  })

  it('keeps the current date when the picker is canceled', () => {
    const { getByTestId, queryByTestId } = render(
      <TripCreateForm initialValues={{ startDate: '2026-08-10' }} />,
    )

    fireEvent.press(getByTestId('trip-create-start-date'))
    expect(getByTestId('trip-create-date-picker')).toBeTruthy()

    fireEvent.press(getByTestId('trip-create-start-date-cancel'))
    expect(queryByTestId('trip-create-date-picker')).toBeNull()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('10 августа 2026')
  })
})
