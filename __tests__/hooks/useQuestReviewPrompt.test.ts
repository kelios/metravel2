/**
 * #1795: мягкая просьба об отзыве после засчитанного прохождения.
 * Ноль отзывов на 177 квестов означал, что просить надо не только на финале —
 * но и не назойливо: один раз на квест, спустя паузу после финиша.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  QUEST_REVIEW_PROMPT_MIN_GAP_MS,
  evaluateQuestReviewPrompt,
} from '@/hooks/useQuestReviewPrompt'
import {
  RETURN_VISIT_WINDOW_MS,
  markQuestReviewLeft,
  markQuestReviewPrompted,
  markQuestReturnReminderScheduled,
  markReturnVisitReported,
  questFinishRecordKey,
  readQuestFinishRecord,
} from '@/utils/questReturnVisit'

const DAY = 24 * 60 * 60 * 1000
const record = {
  ownerId: 'user:7',
  questId: 'minsk-cmok',
  cityId: '3',
  cityName: 'Минск',
  finishedAt: 1_700_000_000_000,
}

describe('evaluateQuestReviewPrompt', () => {
  it('не просит без записи финиша', () => {
    expect(evaluateQuestReviewPrompt(null, record.finishedAt + DAY)).toEqual({ show: false })
  })

  it('не просит второй раз по тому же квесту', () => {
    expect(
      evaluateQuestReviewPrompt(
        { ...record, reviewPromptedAt: record.finishedAt + DAY },
        record.finishedAt + 3 * DAY,
      ),
    ).toEqual({ show: false })
  })

  it('молчит сразу после финиша: там форма и так на экране финала', () => {
    expect(
      evaluateQuestReviewPrompt(record, record.finishedAt + QUEST_REVIEW_PROMPT_MIN_GAP_MS - 1),
    ).toEqual({ show: false })
  })

  it('не просит по часам, уехавшим назад', () => {
    expect(evaluateQuestReviewPrompt(record, record.finishedAt - DAY)).toEqual({ show: false })
  })

  it('не просит по протухшей записи вне окна наблюдения', () => {
    expect(
      evaluateQuestReviewPrompt(record, record.finishedAt + RETURN_VISIT_WINDOW_MS + 1),
    ).toEqual({ show: false })
  })

  it('просит один раз по свежему прохождению и отдаёт квест с городом', () => {
    expect(evaluateQuestReviewPrompt(record, record.finishedAt + 2 * DAY)).toEqual({
      show: true,
      prompt: { questId: 'minsk-cmok', cityId: '3', cityName: 'Минск' },
    })
  })
})

describe('markQuestReviewLeft', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('гасит просьбу по квесту, на который отзыв уже оставлен', async () => {
    await AsyncStorage.setItem(questFinishRecordKey(record.ownerId), JSON.stringify(record))

    await markQuestReviewLeft(record.ownerId, record.questId)

    const stored = await readQuestFinishRecord(record.ownerId)
    expect(stored?.reviewPromptedAt).toEqual(expect.any(Number))
    expect(evaluateQuestReviewPrompt(stored, record.finishedAt + 2 * DAY)).toEqual({ show: false })
  })

  it('не трогает запись другого квеста', async () => {
    await AsyncStorage.setItem(questFinishRecordKey(record.ownerId), JSON.stringify(record))

    await markQuestReviewLeft(record.ownerId, 'grodno-lisy')

    const stored = await readQuestFinishRecord(record.ownerId)
    expect(stored?.reviewPromptedAt).toBeUndefined()
  })
})

describe('общая запись финиша: флаги возврата и просьбы не затирают друг друга', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('сохраняет оба флага, когда возврат пишется снимком без reviewPromptedAt', async () => {
    // Ровно то, что делают два хука на одном монтировании каталога: каждый
    // держит СВОЙ снимок записи, прочитанный до чужой записи.
    await AsyncStorage.setItem(questFinishRecordKey(record.ownerId), JSON.stringify(record))
    const staleSnapshot = { ...record }

    await markQuestReviewPrompted(record, record.finishedAt + DAY)
    await markReturnVisitReported(staleSnapshot)

    const stored = await readQuestFinishRecord(record.ownerId)
    expect(stored?.reviewPromptedAt).toBe(record.finishedAt + DAY)
    expect(stored?.returnReported).toBe(true)
  })

  it('сохраняет оба флага при обратном порядке записи', async () => {
    await AsyncStorage.setItem(questFinishRecordKey(record.ownerId), JSON.stringify(record))
    const staleSnapshot = { ...record }

    await markReturnVisitReported(record)
    await markQuestReviewPrompted(staleSnapshot, record.finishedAt + DAY)

    const stored = await readQuestFinishRecord(record.ownerId)
    expect(stored?.returnReported).toBe(true)
    expect(stored?.reviewPromptedAt).toBe(record.finishedAt + DAY)
  })

  it('не переносит флаг на запись СЛЕДУЮЩЕГО прохождения', async () => {
    const staleSnapshot = { ...record }
    const nextFinish = {
      ...record,
      questId: 'grodno-lisy',
      finishedAt: record.finishedAt + 3 * DAY,
    }
    await AsyncStorage.setItem(questFinishRecordKey(record.ownerId), JSON.stringify(nextFinish))

    await markQuestReviewPrompted(staleSnapshot, record.finishedAt + DAY)
    await markQuestReturnReminderScheduled(staleSnapshot, record.finishedAt + DAY)

    const stored = await readQuestFinishRecord(record.ownerId)
    expect(stored?.questId).toBe('grodno-lisy')
    expect(stored?.reviewPromptedAt).toBeUndefined()
    expect(stored?.reminderScheduledAt).toBeUndefined()
  })
})
