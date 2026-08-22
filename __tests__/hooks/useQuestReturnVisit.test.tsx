/**
 * #1484: возврат в квесты после ранее завершённого квеста докладывается один
 * раз на прохождение — сервер про заходы в каталог ничего не знает.
 */
import React from 'react'
import { Text } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'

const mockSendAnalyticsEvent = jest.fn()
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: (...args: any[]) => mockSendAnalyticsEvent(...args),
  queueAnalyticsEvent: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({
  cancelQuestReturnReminder: jest.fn(async () => undefined),
}))

import AsyncStorage from '@react-native-async-storage/async-storage'

import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit'
import { questFinishRecordKey, RETURN_VISIT_WINDOW_MS } from '@/utils/questReturnVisit'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

function Probe() {
  useQuestReturnVisit()
  return <Text>ok</Text>
}

const writeRecord = (record: Record<string, unknown>) =>
  AsyncStorage.setItem(questFinishRecordKey('guest'), JSON.stringify({ ownerId: 'guest', ...record }))

describe('useQuestReturnVisit', () => {
  beforeEach(async () => {
    mockSendAnalyticsEvent.mockReset()
    await AsyncStorage.clear()
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('молчит, когда завершённых квестов не было', async () => {
    render(<Probe />)
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled())
    expect(mockSendAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('шлёт return_visit_after_finish один раз и помечает запись', async () => {
    await writeRecord({ questId: 'minsk-loshitsa', cityId: '4', finishedAt: NOW - 5 * DAY })

    render(<Probe />)

    await waitFor(() => expect(mockSendAnalyticsEvent).toHaveBeenCalledTimes(1))
    expect(mockSendAnalyticsEvent).toHaveBeenCalledWith('return_visit_after_finish', {
      quest_id: 'minsk-loshitsa',
      city_id: '4',
      days_since_finish: 5,
    })

    const stored = JSON.parse((await AsyncStorage.getItem(questFinishRecordKey('guest'))) as string)
    expect(stored.returnReported).toBe(true)

    // Второй заход по той же записи события уже не даёт.
    mockSendAnalyticsEvent.mockClear()
    render(<Probe />)
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled())
    expect(mockSendAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('чистит запись, вышедшую за окно наблюдения, вместо отправки события', async () => {
    await writeRecord({
      questId: 'minsk-loshitsa',
      cityId: '4',
      finishedAt: NOW - RETURN_VISIT_WINDOW_MS - DAY,
    })

    render(<Probe />)

    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(questFinishRecordKey('guest')))
    expect(mockSendAnalyticsEvent).not.toHaveBeenCalled()
  })
})
