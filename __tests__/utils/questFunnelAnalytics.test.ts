import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { queueAnalyticsEvent } from '@/utils/analytics'
import { __resetAppTelemetry, setAppTelemetryEnabled } from '@/utils/appTelemetry'
import { readConsent } from '@/utils/consent'
import {
  QUEST_FUNNEL_EVENTS,
  clearQuestFunnelRuns,
  resetQuestFunnelRun,
  trackQuestCompleted,
  trackQuestProgress,
  trackQuestStart,
  trackQuestView,
} from '@/utils/questFunnelAnalytics'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3', android: { versionCode: 23 }, ios: { buildNumber: '42' } },
    platform: { ios: { buildNumber: '42' } },
  },
}))
jest.mock('expo-device', () => ({ modelName: 'Pixel', modelId: 'pixel' }))
jest.mock('@/i18n/format', () => ({ getActiveLocale: () => 'ru' }))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }))
jest.mock('@/utils/consent', () => ({ readConsent: jest.fn() }))
jest.mock('@/utils/analyticsContext', () => ({
  getAnalyticsContext: () => ({
    client_id: 'cid-1',
    session_id: 'sid-1',
    auth_state: 'guest',
    device: 'mobile',
    traffic_source: 'google',
    platform: 'web',
  }),
}))

const mockedQueue = queueAnalyticsEvent as jest.MockedFunction<typeof queueAnalyticsEvent>
const mockedConsent = readConsent as jest.MockedFunction<typeof readConsent>
const originalOS = Platform.OS

const QUEST = { questId: 'minsk-1', cityId: 'minsk' }
/** Восьмиточечный квест: пороги не слипаются с первой точкой (1/8 = 12.5%). */
const STEPS = 8

const emitted = () => mockedQueue.mock.calls.map(([name]) => name)
const paramsOf = (eventName: string) =>
  mockedQueue.mock.calls.find(([name]) => name === eventName)?.[1] as Record<string, unknown> | undefined

const allowAnalytics = () =>
  mockedConsent.mockReturnValue({ necessary: true, analytics: true, date: '2026-09-19' })

describe('questFunnelAnalytics', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'web'
    mockedQueue.mockClear()
    window.localStorage.clear()
    allowAnalytics()
  })

  afterAll(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  it('не шлёт событий и не пишет в хранилище без согласия на аналитику', () => {
    mockedConsent.mockReturnValue({ necessary: true, analytics: false, date: '2026-09-19' })

    trackQuestView(QUEST)
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: STEPS })

    expect(mockedQueue).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
  })

  it('проходит все семь шагов воронки по порядку', () => {
    trackQuestView({ ...QUEST, source: 'quest_detail' })
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    for (const passedCount of [1, 2, 3, 4, 5, 6, 7, 8]) {
      trackQuestProgress({ ...QUEST, passedCount, stepsCount: STEPS })
    }
    trackQuestCompleted({ ...QUEST, passedCount: STEPS, stepsCount: STEPS })

    expect(emitted()).toEqual([
      QUEST_FUNNEL_EVENTS.view,
      QUEST_FUNNEL_EVENTS.start,
      QUEST_FUNNEL_EVENTS.firstPoint,
      QUEST_FUNNEL_EVENTS.progress25,
      QUEST_FUNNEL_EVENTS.progress50,
      QUEST_FUNNEL_EVENTS.progress75,
      QUEST_FUNNEL_EVENTS.completed,
    ])
    // Поверхность входа и источник визита — разные измерения и разные имена:
    // `source` в проекте означает поверхность UI, а не канал трафика.
    expect(paramsOf(QUEST_FUNNEL_EVENTS.view)).toMatchObject({
      source: 'quest_detail',
      traffic_source: 'google',
    })
  })

  it('размечает каждое событие общими измерениями и прохождением', () => {
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    // По одной точке за тик: скачок через точку — это восстановление, а не игра.
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 2, stepsCount: STEPS })

    const startParams = paramsOf(QUEST_FUNNEL_EVENTS.start)
    const milestoneParams = paramsOf(QUEST_FUNNEL_EVENTS.progress25)

    expect(startParams).toMatchObject({
      quest_id: 'minsk-1',
      city_id: 'minsk',
      client_id: 'cid-1',
      session_id: 'sid-1',
      auth_state: 'guest',
      device: 'mobile',
      traffic_source: 'google',
    })
    // Один и тот же run_id склеивает шаги одного прохождения между собой.
    expect(milestoneParams?.run_id).toBe(startParams?.run_id)
    expect(milestoneParams).toMatchObject({ passed_count: 2, steps_count: 8, progress_pct: 25 })
  })

  it('не повторяет уже взятую веху после перезагрузки страницы', () => {
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 2, stepsCount: STEPS })
    mockedQueue.mockClear()

    // Перезагрузка: рефы компонента обнулились, запись прохождения — нет.
    trackQuestStart({ ...QUEST, passedCount: 2, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 2, stepsCount: STEPS })

    expect(emitted()).toEqual([QUEST_FUNNEL_EVENTS.start])
    expect(paramsOf(QUEST_FUNNEL_EVENTS.start)).toMatchObject({ is_resumed: true })
  })

  it('молча записывает прогресс, приехавший из хранилища или с другого устройства', () => {
    // Квест без intro: визард встаёт на первую точку раньше, чем придёт прогресс.
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    mockedQueue.mockClear()

    // Прогресс приехал: сразу шесть закрытых точек. Игрок их здесь не проходил.
    trackQuestProgress({ ...QUEST, passedCount: 6, stepsCount: STEPS })
    expect(mockedQueue).not.toHaveBeenCalled()

    // Седьмая точка закрыта уже вживую, но все пороги до 75% включительно уже
    // отмечены молча при восстановлении — повторять их нельзя.
    trackQuestProgress({ ...QUEST, passedCount: 7, stepsCount: STEPS })
    expect(emitted()).toEqual([])

    trackQuestCompleted({ ...QUEST, passedCount: STEPS, stepsCount: STEPS })
    // Время старта такого прохождения неизвестно — длительность не сообщается.
    expect(paramsOf(QUEST_FUNNEL_EVENTS.completed)).not.toHaveProperty('duration_sec')
  })

  it('считает время от старта до финиша', () => {
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })

    nowSpy.mockReturnValue(1_000_000 + 90 * 60 * 1000)
    trackQuestCompleted({ ...QUEST, passedCount: STEPS, stepsCount: STEPS })

    expect(paramsOf(QUEST_FUNNEL_EVENTS.completed)).toMatchObject({ duration_sec: 5400 })
    nowSpy.mockRestore()
  })

  it('сброс прогресса начинает новое прохождение со своими вехами', () => {
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: STEPS })
    const firstRunId = paramsOf(QUEST_FUNNEL_EVENTS.start)?.run_id

    resetQuestFunnelRun(QUEST.questId)
    mockedQueue.mockClear()

    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: STEPS })

    expect(emitted()).toEqual([QUEST_FUNNEL_EVENTS.start, QUEST_FUNNEL_EVENTS.firstPoint])
    expect(paramsOf(QUEST_FUNNEL_EVENTS.start)?.run_id).not.toBe(firstRunId)
    expect(paramsOf(QUEST_FUNNEL_EVENTS.start)).toMatchObject({ is_resumed: false })
  })

  it('отправляет все перепрыгнутые пороги, когда точка закрывает сразу два', () => {
    // Четырёхточечный квест: первая же точка — это и первая точка, и 25%.
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: 4 })
    mockedQueue.mockClear()
    trackQuestProgress({ ...QUEST, passedCount: 1, stepsCount: 4 })

    expect(emitted()).toEqual([QUEST_FUNNEL_EVENTS.firstPoint, QUEST_FUNNEL_EVENTS.progress25])
  })

  it('отзыв согласия снимает записи прохождений всех квестов', () => {
    trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })
    trackQuestStart({ questId: 'brest-2', cityId: 'brest', passedCount: 0, stepsCount: STEPS })
    window.localStorage.setItem('unrelated_key', 'keep-me')
    expect(window.localStorage.getItem('metravel_quest_funnel_v1:minsk-1')).toBeTruthy()

    clearQuestFunnelRuns()

    expect(window.localStorage.getItem('metravel_quest_funnel_v1:minsk-1')).toBeNull()
    expect(window.localStorage.getItem('metravel_quest_funnel_v1:brest-2')).toBeNull()
    // Чужие ключи не трогаем: чистим только своё.
    expect(window.localStorage.getItem('unrelated_key')).toBe('keep-me')
  })

  it('не считает вехи до старта прохождения', () => {
    trackQuestProgress({ ...QUEST, passedCount: 3, stepsCount: STEPS })
    expect(mockedQueue).not.toHaveBeenCalled()
  })

  describe('native improve-app switch', () => {
    beforeEach(async () => {
      ;(Platform as { OS: string }).OS = 'android'
      mockedConsent.mockReturnValue(null)
      __resetAppTelemetry()
      await AsyncStorage.clear()
      mockedQueue.mockClear()
    })

    afterEach(() => {
      __resetAppTelemetry()
    })

    it('queues quest_view and quest_start while the switch is on', async () => {
      await setAppTelemetryEnabled(true)
      trackQuestView(QUEST)
      expect(trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })).toBe(true)
      expect(emitted()).toEqual([QUEST_FUNNEL_EVENTS.view, QUEST_FUNNEL_EVENTS.start])
    })

    it('does not latch a start while the switch is off', async () => {
      await setAppTelemetryEnabled(false)
      trackQuestView(QUEST)
      expect(trackQuestStart({ ...QUEST, passedCount: 0, stepsCount: STEPS })).toBe(false)
      expect(mockedQueue).not.toHaveBeenCalled()
    })
  })
})
