import { fireEvent, render } from '@testing-library/react-native'

import QuestGuestGate from '@/components/quests/QuestGuestGate'

// Regression guard for the design-system unification: the three actions must stay
// real, pressable buttons (migrated from ad-hoc Pressable to the canonical ui/Button)
// and keep firing their callbacks.
describe('QuestGuestGate', () => {
  const setup = async () => {
    const onLogin = jest.fn()
    const onRegister = jest.fn()
    const onDismiss = jest.fn()
    const utils = await render(
      <QuestGuestGate
        passedCount={3}
        onLogin={onLogin}
        onRegister={onRegister}
        onDismiss={onDismiss}
      />,
    )
    return { ...utils, onLogin, onRegister, onDismiss }
  }

  it('renders login, register and dismiss actions as buttons', async () => {
    const { getByTestId } = await setup()

    const login = getByTestId('quest-guest-gate-login')
    const register = getByTestId('quest-guest-gate-register')
    const dismiss = getByTestId('quest-guest-gate-dismiss')

    expect(login.props.accessibilityRole).toBe('button')
    expect(register.props.accessibilityRole).toBe('button')
    expect(dismiss.props.accessibilityRole).toBe('button')
  })

  it('fires the matching callback for each action', async () => {
    const { getByTestId, onLogin, onRegister, onDismiss } = await setup()

    await fireEvent.press(getByTestId('quest-guest-gate-login'))
    expect(onLogin).toHaveBeenCalledTimes(1)

    await fireEvent.press(getByTestId('quest-guest-gate-register'))
    expect(onRegister).toHaveBeenCalledTimes(1)

    await fireEvent.press(getByTestId('quest-guest-gate-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
