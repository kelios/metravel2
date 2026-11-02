// #2939: гостевой прогресс адвента уходит на сервер перед регистрацией, чтобы
// подтверждение по письму в другом браузере перенесло его в аккаунт.

const mockSendAdventGuestHandoff = jest.fn()

jest.mock('@/api/advent', () => ({
  sendAdventGuestHandoff: (...args: unknown[]) => mockSendAdventGuestHandoff(...args),
}))

jest.mock('@/utils/questAnswerTelemetry', () => ({
  getQuestAttemptSessionKey: jest.fn().mockResolvedValue('6a2955c0-0000-4000-8000-000000000001'),
}))

import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { prepareAdventGuestHandoff } from '@/utils/advent/adventGuestHandoff'

beforeEach(() => {
  jest.clearAllMocks()
  mockSendAdventGuestHandoff.mockResolvedValue(undefined)
  useAdventProgressStore.setState({ byOwner: {} })
})

describe('prepareAdventGuestHandoff', () => {
  it('отправляет гостевой снимок в форме POST /advent/progress/ и возвращает ключ сессии', async () => {
    useAdventProgressStore.setState({
      byOwner: {
        guest: { opened: { '1': '2026-12-01', '2': '2026-12-02' }, tasksDone: {} },
        u7: { opened: { '9': '2026-12-09' }, tasksDone: { '9': '2026-12-09' } },
      },
    })

    await expect(prepareAdventGuestHandoff()).resolves.toBe('6a2955c0-0000-4000-8000-000000000001')

    expect(mockSendAdventGuestHandoff).toHaveBeenCalledTimes(1)
    expect(mockSendAdventGuestHandoff).toHaveBeenCalledWith({
      session_key: '6a2955c0-0000-4000-8000-000000000001',
      progress: { opened: { '1': '2026-12-01', '2': '2026-12-02' }, tasks_done: {} },
    })
    // Снимок не трогает локальную копию: перенос в этом браузере делает `adoptGuest`.
    expect(useAdventProgressStore.getState().byOwner.guest.opened['1']).toBe('2026-12-01')
  })

  it('без гостевого прогресса ничего не шлёт', async () => {
    await expect(prepareAdventGuestHandoff()).resolves.toBeNull()
    useAdventProgressStore.setState({ byOwner: { guest: { opened: {}, tasksDone: {} } } })
    await expect(prepareAdventGuestHandoff()).resolves.toBeNull()
    expect(mockSendAdventGuestHandoff).not.toHaveBeenCalled()
  })

  it('сбой снимка (404 до выката бэка, сеть) не блокирует регистрацию', async () => {
    useAdventProgressStore.setState({ byOwner: { guest: { opened: { '1': '2026-12-01' }, tasksDone: {} } } })
    mockSendAdventGuestHandoff.mockRejectedValue(new Error('404'))

    await expect(prepareAdventGuestHandoff()).resolves.toBeNull()
  })
})
