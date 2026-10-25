import { DEMAND_LOG_MAX_ENTRIES, exportDemandLog, logDemand, readDemandLog } from '@/api/aiAssist/demandLog'
import {
  AI_ASK_DAILY_LIMIT,
  AI_OFFTOPIC_STRIKES_TO_BLOCK,
  consumeQuestion,
  quotaDayKey,
  readOffTopicState,
  readRemainingQuestions,
  registerOffTopicStrike,
  type QuotaStorage,
} from '@/api/aiAssist/limits'

const memoryStorage = (): QuotaStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value)
    },
  }
}

describe('aiAssist daily limit (#2460)', () => {
  it('двадцать вопросов в сутки, остаток не уходит в минус', async () => {
    const storage = memoryStorage()
    expect(await readRemainingQuestions({ storage })).toBe(AI_ASK_DAILY_LIMIT)
    let remaining = AI_ASK_DAILY_LIMIT
    for (let i = 0; i < AI_ASK_DAILY_LIMIT; i += 1) {
      remaining = await consumeQuestion({ storage })
    }
    expect(remaining).toBe(0)
    expect(await consumeQuestion({ storage })).toBe(0)
    expect(await readRemainingQuestions({ storage })).toBe(0)
  })

  it('на следующий день счётчик обнуляется', async () => {
    const storage = memoryStorage()
    const day1 = () => new Date(2026, 9, 18, 23, 50)
    const day2 = () => new Date(2026, 9, 19, 0, 5)
    expect(quotaDayKey(day1())).toBe('2026-10-18')
    await consumeQuestion({ storage, now: day1 })
    await consumeQuestion({ storage, now: day1 })
    expect(await readRemainingQuestions({ storage, now: day1 })).toBe(AI_ASK_DAILY_LIMIT - 2)
    expect(await readRemainingQuestions({ storage, now: day2 })).toBe(AI_ASK_DAILY_LIMIT)
  })

  it('битая запись в хранилище читается как пустая', async () => {
    const storage = memoryStorage()
    storage.data.set('metravel.aiAssist.quota.v1', '{not json')
    expect(await readRemainingQuestions({ storage })).toBe(AI_ASK_DAILY_LIMIT)
  })
})

describe('aiAssist demand log (#2460)', () => {
  it('пишет вопрос без материалов, ограничивает размер и экспортирует JSONL', async () => {
    const storage = memoryStorage()
    const now = () => new Date('2026-10-18T10:00:00.000Z')
    await logDemand({ q: '  Исландия зимой  ', locale: 'ru', reason: 'no_sources' }, { storage, now })
    await logDemand({ q: '', locale: 'ru', reason: 'no_sources' }, { storage, now })
    const entries = await readDemandLog({ storage })
    expect(entries).toEqual([{ ts: '2026-10-18T10:00:00.000Z', q: 'Исландия зимой', locale: 'ru', reason: 'no_sources' }])
    expect(await exportDemandLog({ storage })).toBe(JSON.stringify(entries[0]))

    for (let i = 0; i < DEMAND_LOG_MAX_ENTRIES + 5; i += 1) {
      await logDemand({ q: `q${i}`, locale: 'en', reason: 'generator_unavailable' }, { storage, now })
    }
    const capped = await readDemandLog({ storage })
    expect(capped).toHaveLength(DEMAND_LOG_MAX_ENTRIES)
    expect(capped[capped.length - 1].q).toBe(`q${DEMAND_LOG_MAX_ENTRIES + 4}`)
  })
})

describe('aiAssist off-topic strikes (#2711)', () => {
  const memory = () => {
    const data = new Map<string, string>()
    const storage: QuotaStorage = {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, value)
      },
    }
    return storage
  }

  it('1-й и 2-й — предупреждение, 3-й — блок до конца дня; дневной лимит не трогается', async () => {
    const storage = memory()
    const now = () => new Date(2026, 9, 25, 10, 0)
    expect(await readOffTopicState({ storage, now })).toEqual({ strikes: 0, blocked: false })
    expect(await registerOffTopicStrike({ storage, now })).toEqual({ strikes: 1, blocked: false })
    expect(await registerOffTopicStrike({ storage, now })).toEqual({ strikes: 2, blocked: false })
    expect(await registerOffTopicStrike({ storage, now })).toEqual({ strikes: AI_OFFTOPIC_STRIKES_TO_BLOCK, blocked: true })
    expect(await registerOffTopicStrike({ storage, now })).toEqual({ strikes: AI_OFFTOPIC_STRIKES_TO_BLOCK, blocked: true })
    expect(await readRemainingQuestions({ storage, now })).toBe(AI_ASK_DAILY_LIMIT)
    expect(await readOffTopicState({ storage, now: () => new Date(2026, 9, 26, 0, 1) })).toEqual({ strikes: 0, blocked: false })
  })
})
