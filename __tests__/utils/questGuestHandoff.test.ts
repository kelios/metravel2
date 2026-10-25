// #2739: снимок гостевого прогресса квеста уходит на сервер перед регистрацией,
// чтобы подтверждение по письму в другом браузере перенесло его в аккаунт.

import AsyncStorage from '@react-native-async-storage/async-storage'

const mockSendQuestGuestHandoff = jest.fn()

jest.mock('@/api/quests', () => ({
  sendQuestGuestHandoff: (...args: unknown[]) => mockSendQuestGuestHandoff(...args),
}))

jest.mock('@/utils/questAnswerTelemetry', () => ({
  getQuestAttemptSessionKey: jest.fn().mockResolvedValue('6a2955c0-0000-4000-8000-000000000001'),
}))

import { saveGuestQuestProgress } from '@/utils/guestQuestProgress'
import { isQuestHandoffPath, parseQuestHandoff, prepareQuestGuestHandoff } from '@/utils/questGuestHandoff'

const REDIRECT = '/quests/grodno/grodno-royal'

const guestProgress = {
  currentIndex: 2,
  unlockedIndex: 2,
  answers: { kalozha: 'борисоглебская', 'old-castle': 'меч' },
  attempts: { kalozha: 1, 'old-castle': 2 },
  hints: { 'old-castle': true },
  showMap: true,
  updatedAt: 1_761_396_600_000,
  answeredAt: { kalozha: 1_761_396_000_000, 'old-castle': 1_761_396_600_000 },
}

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  mockSendQuestGuestHandoff.mockResolvedValue(null)
})

describe('isQuestHandoffPath', () => {
  it('пускает только путь квеста своего сайта', () => {
    expect(isQuestHandoffPath(REDIRECT)).toBe(true)
    expect(isQuestHandoffPath('/quests')).toBe(false)
    expect(isQuestHandoffPath('//evil.example/quests/a/b')).toBe(false)
    expect(isQuestHandoffPath('/quests/a/b?next=//evil')).toBe(false)
    expect(isQuestHandoffPath('https://metravel.by/quests/a/b')).toBe(false)
    expect(isQuestHandoffPath(undefined)).toBe(false)
  })
})

describe('parseQuestHandoff', () => {
  it('разбирает ответ подтверждения по контракту #2749', () => {
    expect(parseQuestHandoff({ quest_id: 'grodno-royal', redirect_path: REDIRECT, answered: 2 })).toEqual({
      questId: 'grodno-royal',
      redirectPath: REDIRECT,
      answered: 2,
    })
  })

  it('без переноса или с чужим путём — null', () => {
    expect(parseQuestHandoff(null)).toBeNull()
    expect(parseQuestHandoff(undefined)).toBeNull()
    expect(parseQuestHandoff({ quest_id: '', redirect_path: REDIRECT })).toBeNull()
    expect(parseQuestHandoff({ quest_id: 'q', redirect_path: '/' })).toBeNull()
  })
})

describe('prepareQuestGuestHandoff', () => {
  it('отправляет гостевой снимок под ключом телеметрии и возвращает ключ', async () => {
    await saveGuestQuestProgress('grodno-royal', guestProgress)

    await expect(prepareQuestGuestHandoff(REDIRECT)).resolves.toBe('6a2955c0-0000-4000-8000-000000000001')

    expect(mockSendQuestGuestHandoff).toHaveBeenCalledTimes(1)
    expect(mockSendQuestGuestHandoff).toHaveBeenCalledWith({
      session_key: '6a2955c0-0000-4000-8000-000000000001',
      quest_id: 'grodno-royal',
      redirect_path: REDIRECT,
      progress: expect.objectContaining({
        current_index: 2,
        unlocked_index: 2,
        answers: guestProgress.answers,
        attempts: guestProgress.attempts,
        hints: guestProgress.hints,
        answered_at: guestProgress.answeredAt,
        updated_at: guestProgress.updatedAt,
      }),
    })
  })

  it('без гостевых ответов ничего не шлёт', async () => {
    await saveGuestQuestProgress('grodno-royal', { ...guestProgress, answers: {} })

    await expect(prepareQuestGuestHandoff(REDIRECT)).resolves.toBeNull()
    await expect(prepareQuestGuestHandoff('/quests/minsk/minsk-cmok')).resolves.toBeNull()
    expect(mockSendQuestGuestHandoff).not.toHaveBeenCalled()
  })

  it('регистрация не из квеста — снимка нет', async () => {
    await saveGuestQuestProgress('grodno-royal', guestProgress)

    await expect(prepareQuestGuestHandoff(undefined)).resolves.toBeNull()
    await expect(prepareQuestGuestHandoff('/profile')).resolves.toBeNull()
    expect(mockSendQuestGuestHandoff).not.toHaveBeenCalled()
  })

  it('сервер не принял снимок (401/404 до выката #2749) — регистрация идёт без ключа, локальная копия цела', async () => {
    await saveGuestQuestProgress('grodno-royal', guestProgress)
    mockSendQuestGuestHandoff.mockRejectedValue(new Error('401'))

    await expect(prepareQuestGuestHandoff(REDIRECT)).resolves.toBeNull()
    expect(await AsyncStorage.getItem('guestQuestProgress:v1:grodno-royal')).not.toBeNull()
  })
})
