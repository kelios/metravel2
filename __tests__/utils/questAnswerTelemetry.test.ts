// #1276: очередь попыток ответа. Квест проходят на улице, часто без сети, и
// гость пишет так же, как залогиненный — событие не имеет права пропасть между
// вводом и доставкой. Проверяем ровно три инварианта: приватность свободного
// ответа, переживание офлайна и идемпотентность повторного флеша.
import AsyncStorage from '@react-native-async-storage/async-storage'

const mockSendQuestAnswerAttempts = jest.fn()

jest.mock('@/api/quests', () => ({
  sendQuestAnswerAttempts: (...args: any[]) => mockSendQuestAnswerAttempts(...args),
}))

import { ApiError } from '@/api/clientErrors'
import {
  FLUSH_BATCH_SIZE,
  QUEST_ATTEMPTS_QUEUE_KEY,
  __resetQuestAnswerTelemetry,
  createClientAttemptId,
  flushQuestAnswerAttempts,
  recordQuestAnswerAttempt,
} from '@/utils/questAnswerTelemetry'

const readQueue = async (): Promise<any[]> => {
  const raw = await AsyncStorage.getItem(QUEST_ATTEMPTS_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

const attempt = (overrides: Record<string, unknown> = {}) => ({
  questNumericId: 32,
  stepId: '3-pobeda',
  verdict: 'rejected' as const,
  normalized: '33',
  isFreeText: false,
  attemptNo: 1,
  hintShown: false,
  elapsedMs: 45231,
  ...overrides,
})

beforeEach(async () => {
  __resetQuestAnswerTelemetry()
  await AsyncStorage.clear()
  mockSendQuestAnswerAttempts.mockReset()
  mockSendQuestAnswerAttempts.mockResolvedValue({ accepted: 1, duplicates: 0, rejected: 0 })
})

afterEach(() => {
  __resetQuestAnswerTelemetry()
})

describe('createClientAttemptId', () => {
  it('выдаёт uuid4 и не повторяется', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientAttemptId()))
    expect(ids.size).toBe(200)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })
})

describe('приватность свободного ответа', () => {
  it('any_text уходит без raw_answer, но с длиной ответа', async () => {
    await recordQuestAnswerAttempt(
      attempt({
        stepId: '7-naberezhnaya-piny',
        isFreeText: true,
        normalized: 'тут тихо и пахнет рекой',
        verdict: 'accepted',
      }),
    )

    const [event] = await readQueue()
    expect(event.raw_answer).toBeUndefined()
    expect(event.answer_length).toBeGreaterThan(0)
    expect(event.verdict).toBe('accepted')
  })

  it('закрытый тип ответа сохраняет сырой ввод — из него пополняется словарь', async () => {
    await recordQuestAnswerAttempt(attempt())

    const [event] = await readQueue()
    expect(event.raw_answer).toBe('33')
    expect(event.answer_length).toBe(2)
  })

  it('событие без числового id квеста не копится: его некуда доставить', async () => {
    await recordQuestAnswerAttempt(attempt({ questNumericId: undefined }))
    expect(await readQueue()).toHaveLength(0)
  })
})

describe('очередь переживает офлайн', () => {
  it('три события остаются в хранилище, после сети уходят одним батчем и не дублируются', async () => {
    mockSendQuestAnswerAttempts.mockRejectedValue(new Error('Network request failed'))

    await recordQuestAnswerAttempt(attempt({ normalized: '33', attemptNo: 1 }))
    await recordQuestAnswerAttempt(attempt({ normalized: '9', attemptNo: 2 }))
    await recordQuestAnswerAttempt(attempt({ normalized: '1945', attemptNo: 3 }))
    await flushQuestAnswerAttempts()

    const offlineQueue = await readQueue()
    expect(offlineQueue).toHaveLength(3)
    const offlineIds = offlineQueue.map((event) => event.client_attempt_id)

    mockSendQuestAnswerAttempts.mockReset()
    mockSendQuestAnswerAttempts.mockResolvedValue({ accepted: 3, duplicates: 0, rejected: 0 })
    await flushQuestAnswerAttempts()

    expect(mockSendQuestAnswerAttempts).toHaveBeenCalledTimes(1)
    const payload = mockSendQuestAnswerAttempts.mock.calls[0][0]
    expect(payload.quest_id).toBe(32)
    expect(payload.session_key).toEqual(expect.any(String))
    expect(payload.attempts).toHaveLength(3)
    // Ключ идемпотентности пережил неуспешную попытку: повторная доставка
    // схлопнется на сервере в duplicates, а не создаст вторую строку.
    expect(payload.attempts.map((a: any) => a.client_attempt_id)).toEqual(offlineIds)
    // Внутреннее поле адресации в тело события не протекает.
    expect(payload.attempts[0].quest_id).toBeUndefined()

    expect(await readQueue()).toHaveLength(0)
    await flushQuestAnswerAttempts()
    expect(mockSendQuestAnswerAttempts).toHaveBeenCalledTimes(1)
  })

  it('батч не превышает 10 событий и не смешивает квесты', async () => {
    for (let i = 0; i < 12; i += 1) {
      await recordQuestAnswerAttempt(attempt({ attemptNo: i + 1 }))
    }
    await recordQuestAnswerAttempt(attempt({ questNumericId: 37, stepId: '4-pinchuk' }))
    await flushQuestAnswerAttempts()

    const payloads = mockSendQuestAnswerAttempts.mock.calls.map((call) => call[0])
    for (const payload of payloads) {
      expect(payload.attempts.length).toBeLessThanOrEqual(FLUSH_BATCH_SIZE)
      expect(payload.attempts.length).toBeGreaterThan(0)
    }
    const delivered = payloads.flatMap((payload) =>
      payload.attempts.map((a: any) => `${payload.quest_id}:${a.client_attempt_id}`),
    )
    expect(new Set(delivered).size).toBe(13)
    expect(delivered.filter((key) => key.startsWith('37:'))).toHaveLength(1)
    expect(await readQueue()).toHaveLength(0)
  })

  it('4xx кроме 429 снимает батч с очереди — иначе он затыкает доставку навсегда', async () => {
    mockSendQuestAnswerAttempts.mockRejectedValueOnce(new ApiError(400, 'bad payload'))
    mockSendQuestAnswerAttempts.mockResolvedValueOnce({ accepted: 1, duplicates: 0, rejected: 0 })

    await recordQuestAnswerAttempt(attempt())
    await recordQuestAnswerAttempt(attempt({ questNumericId: 37, stepId: '4-pinchuk' }))
    await flushQuestAnswerAttempts()

    expect(await readQueue()).toHaveLength(0)
    expect(mockSendQuestAnswerAttempts).toHaveBeenCalledTimes(2)
  })

  it('429 придерживает батч: события остаются до следующей попытки', async () => {
    mockSendQuestAnswerAttempts.mockRejectedValue(new ApiError(429, 'too many'))

    await recordQuestAnswerAttempt(attempt())
    await flushQuestAnswerAttempts()

    expect(await readQueue()).toHaveLength(1)
  })
})
