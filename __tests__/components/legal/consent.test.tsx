import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }))
jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

const mockPostConsentRecord = jest.fn().mockResolvedValue(undefined)
jest.mock('@/api/consent', () => ({
  postConsentRecord: (...args: unknown[]) => mockPostConsentRecord(...args),
}))

import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import DataFreshnessNotice from '@/components/legal/DataFreshnessNotice'
import QuestConsentGate from '@/components/quests/QuestConsentGate'
import {
  CONSENT_TYPES,
  hasActionConsent,
  readActionConsentsSync,
  recordActionConsent,
} from '@/utils/actionConsent'

describe('actionConsent storage (web)', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'web'
    window.localStorage.clear()
    mockPostConsentRecord.mockClear()
  })

  it('returns false before consent is recorded', () => {
    expect(hasActionConsent(readActionConsentsSync(), CONSENT_TYPES.QUEST_START)).toBe(false)
  })

  it('records and reads back a consent with type/version/date', async () => {
    await recordActionConsent(CONSENT_TYPES.QUEST_START)
    const store = readActionConsentsSync()

    expect(hasActionConsent(store, CONSENT_TYPES.QUEST_START)).toBe(true)
    expect(store[CONSENT_TYPES.QUEST_START].version).toBe('1')
    expect(typeof store[CONSENT_TYPES.QUEST_START].date).toBe('string')
  })

  it('treats a different version as not-yet-consented (re-prompt on text update)', async () => {
    await recordActionConsent(CONSENT_TYPES.QUEST_START, '1')
    const store = readActionConsentsSync()

    expect(hasActionConsent(store, CONSENT_TYPES.QUEST_START, '2')).toBe(false)
  })

  it('fires non-blocking BE tracking (#435) after local save', async () => {
    await recordActionConsent(CONSENT_TYPES.TRIP_APPLY, '1')

    // Local save is the source of truth and must succeed regardless of BE.
    expect(hasActionConsent(readActionConsentsSync(), CONSENT_TYPES.TRIP_APPLY)).toBe(true)
    // BE record attempted with the same type/version.
    expect(mockPostConsentRecord).toHaveBeenCalledWith(CONSENT_TYPES.TRIP_APPLY, '1')
  })
})

describe('ConsentCheckbox', () => {
  it('exposes the checked state to web assistive technology', () => {
    const { getByTestId } = render(
      <ConsentCheckbox checked onToggle={jest.fn()} testID="cb">
        Я согласен
      </ConsentCheckbox>,
    )

    expect(getByTestId('cb').props['aria-checked']).toBe(true)
  })

  it('toggles to the opposite state on press', () => {
    const onToggle = jest.fn()
    const { getByTestId } = render(
      <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
        Я согласен
      </ConsentCheckbox>,
    )

    fireEvent.press(getByTestId('cb'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})

describe('DataFreshnessNotice', () => {
  it('renders the default "data may be outdated" warning', () => {
    const { getByText } = render(<DataFreshnessNotice />)
    expect(getByText(/информация может быть неактуальной/i)).toBeTruthy()
  })
})

describe('QuestConsentGate', () => {
  it('blocks the start button until the consent checkbox is checked', () => {
    const onAccept = jest.fn()
    const { getByTestId } = render(
      <QuestConsentGate title="Тестовый квест" onAccept={onAccept} />,
    )

    const startButton = getByTestId('quest-consent-start')
    expect(startButton.props.accessibilityState?.disabled).toBe(true)

    // Press while disabled — nothing happens.
    fireEvent.press(startButton)
    expect(onAccept).not.toHaveBeenCalled()

    // Check the box, then start becomes actionable.
    fireEvent.press(getByTestId('quest-consent-checkbox'))
    const enabledButton = getByTestId('quest-consent-start')
    expect(enabledButton.props.accessibilityState?.disabled).toBe(false)

    fireEvent.press(enabledButton)
    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})
