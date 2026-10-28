import React from 'react'
import { fireEvent, render, within } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }))
jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, children)
  },
}))

const mockPostConsentRecord = jest.fn().mockResolvedValue(undefined)
jest.mock('@/api/consent', () => ({
  postConsentRecord: (...args: unknown[]) => mockPostConsentRecord(...args),
}))

jest.mock('@/hooks/usePublicTripsApi', () => ({
  useSubmitApplication: () => ({ mutate: jest.fn(), isPending: false }),
}))

import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import DataFreshnessNotice from '@/components/legal/DataFreshnessNotice'
import QuestConsentGate from '@/components/quests/QuestConsentGate'
import TripApplyForm from '@/components/trips/TripApplyForm'
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
  it('exposes the checked state to web assistive technology', async () => {
    const { getByTestId } = await render(
      <ConsentCheckbox checked onToggle={jest.fn()} testID="cb">
        Я согласен
      </ConsentCheckbox>,
    )

    expect(getByTestId('cb').props['aria-checked']).toBe(true)
  })

  it('toggles to the opposite state on press', async () => {
    const onToggle = jest.fn()
    const { getByTestId } = await render(
      <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
        Я согласен
      </ConsentCheckbox>,
    )

    await fireEvent.press(getByTestId('cb'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  // #2093: тап по подписи (не только по квадрату 44×44) переключает чекбокс.
  it('toggles when the label text itself is pressed, not only the square', async () => {
    const onToggle = jest.fn()
    const { getByText } = await render(
      <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
        Я согласен с условиями
      </ConsentCheckbox>,
    )

    await fireEvent.press(getByText('Я согласен с условиями'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  // #2093: вложенная ссылка внутри подписи (как `<Link>` в TripApplyForm)
  // перехватывает press на себе и не должна переключать чекбокс. На native
  // `<Link>` без `asChild` рендерится как `Text` со своим `onPress`
  // (`BaseExpoRouterLink`), поэтому воспроизводим ту же форму напрямую.
  it('does not toggle when a nested link inside the label is pressed, and fires the link handler', async () => {
    const onToggle = jest.fn()
    const linkPress = jest.fn()
    const { getByText } = await render(
      <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
        Я согласен с{' '}
        <Text onPress={linkPress} accessibilityRole="link">
          Правилами поездок
        </Text>
      </ConsentCheckbox>,
    )

    await fireEvent.press(getByText('Правилами поездок'))
    expect(linkPress).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
  })

  // #2093: подпись со ссылками не должна стать потомком узла с ролью
  // `checkbox`: доступный `Pressable` на iOS — лист дерева VoiceOver (ссылки
  // недостижимы), а на вебе `<a>` внутри `role="checkbox"` — вложенный
  // интерактив. Роль checkbox — ровно одна и только у квадрата.
  it('keeps the label and its links outside the single checkbox node', async () => {
    const { getAllByRole, getByTestId, getByText } = await render(
      <ConsentCheckbox checked={false} onToggle={jest.fn()} testID="cb">
        Я согласен с{' '}
        <Text onPress={jest.fn()} accessibilityRole="link">
          Правилами поездок
        </Text>
      </ConsentCheckbox>,
    )

    expect(getAllByRole('checkbox')).toHaveLength(1)
    expect(getAllByRole('checkbox')[0]).toBe(getByTestId('cb'))
    expect(within(getByTestId('cb')).queryByText(/Я согласен/)).toBeNull()
    expect(within(getByTestId('cb')).queryByText('Правилами поездок')).toBeNull()
    expect(getByText(/Я согласен/).props.accessibilityRole).toBeUndefined()
  })

  // #2093: на вебе `<Link>` без `asChild` рендерится react-native-web'ом как
  // `<a href>` с `onClick` без `stopPropagation` (`BaseExpoRouterLink`), и
  // клик по нему после перехода всплывает в `onClick` подписи.
  // `test-renderer` не проигрывает реальное всплытие DOM, поэтому жмём
  // на подпись с фейковым событием, чей `target` лежит внутри `<a>`, — так
  // выглядит событие, дошедшее до подписи после клика по вложенной ссылке.
  describe('web DOM click bubbling from a nested <a> (RNW-specific)', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
      ;(Platform as { OS: string }).OS = 'web'
    })

    afterEach(() => {
      ;(Platform as { OS: string }).OS = originalOS
    })

    it('ignores a bubbled label click whose target is inside an anchor', async () => {
      const onToggle = jest.fn()
      const { getByText } = await render(
        <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
          Я согласен
        </ConsentCheckbox>,
      )

      await fireEvent.press(getByText('Я согласен'), {
        target: { closest: (selector: string) => (selector === 'a' ? {} : null) },
      })

      expect(onToggle).not.toHaveBeenCalled()
    })

    it('still toggles a label click whose target is not inside an anchor', async () => {
      const onToggle = jest.fn()
      const { getByText } = await render(
        <ConsentCheckbox checked={false} onToggle={onToggle} testID="cb">
          Я согласен
        </ConsentCheckbox>,
      )

      await fireEvent.press(getByText('Я согласен'), {
        target: { closest: () => null },
      })

      expect(onToggle).toHaveBeenCalledWith(true)
    })
  })

  // #2109: RNW activates Enter on role=checkbox, but Space only on role=button,
  // so Space scrolls the page instead of toggling. Enter stays on that path.
  describe('web keyboard (#2109)', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
      ;(Platform as { OS: string }).OS = 'web'
    })

    afterEach(() => {
      ;(Platform as { OS: string }).OS = originalOS
    })

    function CheckboxHarness() {
      const [checked, setChecked] = React.useState(false)
      return (
        <ConsentCheckbox checked={checked} onToggle={setChecked} testID="cb">
          Я согласен
        </ConsentCheckbox>
      )
    }

    it('toggles checked on Space and calls preventDefault so the page does not scroll', async () => {
      const { getByRole } = await render(<CheckboxHarness />)
      const preventDefault = jest.fn()

      await fireEvent(getByRole('checkbox'), 'keyDown', { key: ' ', preventDefault })

      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true)
    })

    it('prevents scrolling throughout held Space without toggling repeatedly', async () => {
      const { getByRole } = await render(<CheckboxHarness />)
      const preventDefault = jest.fn()

      await fireEvent(getByRole('checkbox'), 'keyDown', { key: ' ', preventDefault })
      await fireEvent(getByRole('checkbox'), 'keyDown', { key: ' ', repeat: true, preventDefault })
      await fireEvent(getByRole('checkbox'), 'keyDown', { key: ' ', repeat: true, preventDefault })

      expect(preventDefault).toHaveBeenCalledTimes(3)
      expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true)

      // A fresh press after releasing Space switches the checkbox off again.
      await fireEvent(getByRole('checkbox'), 'keyDown', { key: ' ', repeat: false, preventDefault })
      expect(getByRole('checkbox').props.accessibilityState.checked).toBe(false)
    })

    it('leaves Enter handling to Pressable and keeps onPress functional', async () => {
      const { getByRole } = await render(<CheckboxHarness />)
      const checkbox = getByRole('checkbox')
      const preventDefault = jest.fn()

      await fireEvent(checkbox, 'keyDown', { key: 'Enter', preventDefault })
      // Enter must not be swallowed by the Space handler. RNW turns that
      // keyup into onPress; the test renderer does not run the browser listener.
      expect(preventDefault).not.toHaveBeenCalled()
      await fireEvent.press(checkbox)

      expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true)
    })
  })
})

describe('TripApplyForm consent names (#2109)', () => {
  it('gives both consent checkboxes a non-empty accessible name with the full consent text', async () => {
    const { getByTestId } = await render(<TripApplyForm trip={{ id: 1 } as never} />)

    const rulesLabel = getByTestId('trip-apply-consent-rules').props.accessibilityLabel
    const disclaimerLabel = getByTestId('trip-apply-consent-disclaimer').props.accessibilityLabel

    expect(typeof rulesLabel).toBe('string')
    expect(rulesLabel.trim().length).toBeGreaterThan(0)
    expect(rulesLabel).toBe('Я ознакомился с правилами поездок и правилами сообщества.')

    expect(typeof disclaimerLabel).toBe('string')
    expect(disclaimerLabel.trim().length).toBeGreaterThan(0)
    expect(disclaimerLabel).toBe(
      'Я понимаю, что MeTravel не организует поездку и не несёт ответственности за договорённости участников.',
    )
  })
})

describe('DataFreshnessNotice', () => {
  it('renders the default "data may be outdated" warning', async () => {
    const { getByText } = await render(<DataFreshnessNotice />)
    expect(getByText(/информация может быть неактуальной/i)).toBeTruthy()
  })
})

describe('QuestConsentGate', () => {
  it('blocks the start button until the consent checkbox is checked', async () => {
    const onAccept = jest.fn()
    const { getByTestId } = await render(
      <QuestConsentGate title="Тестовый квест" onAccept={onAccept} />,
    )

    const startButton = getByTestId('quest-consent-start')
    expect(startButton.props.accessibilityState?.disabled).toBe(true)

    // Press while disabled — nothing happens.
    await fireEvent.press(startButton)
    expect(onAccept).not.toHaveBeenCalled()

    // Check the box, then start becomes actionable.
    await fireEvent.press(getByTestId('quest-consent-checkbox'))
    const enabledButton = getByTestId('quest-consent-start')
    expect(enabledButton.props.accessibilityState?.disabled).toBe(false)

    await fireEvent.press(enabledButton)
    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})
