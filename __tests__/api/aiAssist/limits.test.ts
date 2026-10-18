import { DEMAND_LOG_MAX_ENTRIES, exportDemandLog, logDemand, readDemandLog } from '@/api/aiAssist/demandLog'
import { AI_ASK_DAILY_LIMIT, consumeQuestion, quotaDayKey, readRemainingQuestions, type QuotaStorage } from '@/api/aiAssist/limits'

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
