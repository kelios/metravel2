/**
 * #1484: локальная отметка финиша и решение «это возврат».
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  questFinishRecordKey,
  RETURN_VISIT_MIN_GAP_MS,
  RETURN_VISIT_WINDOW_MS,
  evaluateReturnVisit,
  markReturnVisitReported,
  readQuestFinishRecord,
  rememberQuestFinish,
} from '@/utils/questReturnVisit'

const DAY = 24 * 60 * 60 * 1000

describe('evaluateReturnVisit', () => {
  const record = { ownerId: 'user:7', questId: 'minsk-cmok', cityId: '3', finishedAt: 1_000_000_000 }

  it('ignores a missing or already reported record', () => {
    expect(evaluateReturnVisit(null, record.finishedAt + 7 * DAY)).toEqual({
      report: false,
      expired: false,
    })
    expect(
      evaluateReturnVisit({ ...record, returnReported: true }, record.finishedAt + 7 * DAY),
    ).toEqual({ report: false, expired: false })
  })

  it('does not count the same sitting as a return', () => {
    expect(
      evaluateReturnVisit(record, record.finishedAt + RETURN_VISIT_MIN_GAP_MS - 1),
    ).toEqual({ report: false, expired: false })
  })

  it('does not count a clock that moved backwards', () => {
    expect(evaluateReturnVisit(record, record.finishedAt - DAY)).toEqual({
      report: false,
      expired: false,
    })
  })

  it('reports a return inside the 30-day window with whole days elapsed', () => {
    expect(evaluateReturnVisit(record, record.finishedAt + 7 * DAY + 3600_000)).toEqual({
      report: true,
      expired: false,
      daysSinceFinish: 7,
    })
  })

  it('marks a record outside the window as expired instead of reporting it', () => {
    expect(evaluateReturnVisit(record, record.finishedAt + RETURN_VISIT_WINDOW_MS + 1)).toEqual({
      report: false,
      expired: true,
    })
  })
})

describe('quest finish record storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('stores and reads back the finish', async () => {
    await rememberQuestFinish({
      ownerId: 'user:7',
      questId: 'minsk-cmok',
      cityId: '3',
      cityName: 'Минск',
      finishedAt: 111,
    })
    expect(await readQuestFinishRecord('user:7')).toEqual({
      ownerId: 'user:7',
      questId: 'minsk-cmok',
      cityId: '3',
      cityName: 'Минск',
      finishedAt: 111,
    })
  })

  it('does not restart the countdown while the same finale is being re-rendered', async () => {
    await rememberQuestFinish({ ownerId: 'user:7', questId: 'minsk-cmok', finishedAt: 111 })
    await rememberQuestFinish({ ownerId: 'user:7', questId: 'minsk-cmok', finishedAt: 111 })
    expect((await readQuestFinishRecord('user:7'))?.finishedAt).toBe(111)
  })

  it('replaces a reported record when the next quest is finished', async () => {
    await rememberQuestFinish({ ownerId: 'user:7', questId: 'minsk-cmok', finishedAt: 111 })
    await markReturnVisitReported((await readQuestFinishRecord('user:7'))!)
    await rememberQuestFinish({ ownerId: 'user:7', questId: 'minsk-graffiti', finishedAt: 999 })
    expect(await readQuestFinishRecord('user:7')).toEqual({
      ownerId: 'user:7',
      questId: 'minsk-graffiti',
      finishedAt: 999,
    })
  })

  it('isolates finish records between accounts on one device', async () => {
    await rememberQuestFinish({ ownerId: 'user:7', questId: 'a', finishedAt: 111 })
    await rememberQuestFinish({ ownerId: 'user:8', questId: 'b', finishedAt: 222 })

    expect((await readQuestFinishRecord('user:7'))?.questId).toBe('a')
    expect((await readQuestFinishRecord('user:8'))?.questId).toBe('b')
  })

  it('survives a corrupted payload', async () => {
    await AsyncStorage.setItem(questFinishRecordKey('user:7'), '{oops')
    expect(await readQuestFinishRecord('user:7')).toBeNull()
  })
})
