// #2092: подтверждённая запись прохождения другим писателем (миграция гостя,
// доставка очереди) доходит до смонтированного `useQuestProgressSync` без
// повторного маунта. Здесь — границы этого правила: запись не возвращает на
// экран прохождение, стёртое «Сбросить» (#2043), и не проигрывает более
// старому ответу чтения.
//
// Отдельный файл по той же причине, что и reset-набор: фейковые таймеры в
// этом окружении ломают `waitFor` соседних тестов.
import { act, renderHook } from '@testing-library/react-native'

import type { ApiQuestProgress } from '@/api/quests'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ userId: 'A', isAuthenticated: true }) },
}))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))

/** Строка прохождения на сервере сейчас; `null` — её нет. */
let mockServerRow: ApiQuestProgress | null = null
const mockFetchQuestProgress = jest.fn()
const mockUpdateProgress = jest.fn()
const mockDeleteProgress = jest.fn()

jest.mock('@/api/quests', () => ({
  fetchQuestProgress: (...args: any[]) => mockFetchQuestProgress(...args),
  withQuestProgress: async (_questId: string, task: (progress: any) => Promise<unknown>) =>
    task(mockServerRow ?? { ...mockEmptyRow(461) }),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
}))

const mockEmptyRow = (id: number): ApiQuestProgress => ({
  id, quest: 7, user: 10, current_index: 0, unlocked_index: 0,
  answers: {}, attempts: {}, hints: {}, skipped: {},
  show_map: true, early_finish: false, completed: false,
  completed_at: null, created_at: '2026-09-24T08:00:00Z', updated_at: '2026-09-24T08:00:00Z',
})

const { useQuestProgressSync } = require('@/hooks/useQuestsApi') as typeof import('@/hooks/useQuestsApi')
const { __resetQuestProgressQueue, syncQuestProgressReaders } =
  require('@/utils/questProgressQueue') as typeof import('@/utils/questProgressQueue')

const QUEST_ID = 'brest-teens-erased-city'
const withAnswers = (row: ApiQuestProgress, answers: Record<string, string>): ApiQuestProgress => ({ ...row, answers })
const STARTED = { currentIndex: 1, unlockedIndex: 1, answers: { 'step-1': 'крепость' }, attempts: {}, hints: {}, showMap: true }

const flushMicrotasks = async () => {
  await act(async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve()
  })
}

const mountSync = async () => {
  const rendered = renderHook(() => useQuestProgressSync(QUEST_ID, true))
  await flushMicrotasks()
  return rendered
}

/** Запись другого писателя подтверждена сервером. */
const confirmForeignWrite = async (row: ApiQuestProgress) => {
  act(() => syncQuestProgressReaders(QUEST_ID, 'A', row))
  await flushMicrotasks()
}

describe('useQuestProgressSync — запись другого писателя (#2092)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    __resetQuestProgressQueue()
    mockServerRow = null
    mockFetchQuestProgress.mockImplementation(async () => mockServerRow)
    mockUpdateProgress.mockImplementation(async (id: number, payload: Record<string, unknown>) => ({
      ...mockEmptyRow(id), ...payload,
    }))
    mockDeleteProgress.mockResolvedValue(undefined)
  })

  afterEach(() => {
    __resetQuestProgressQueue()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('строку стёртого «Сбросить» прохождения запись не возвращает, новую — принимает', async () => {
    mockServerRow = withAnswers(mockEmptyRow(42), { 'step-1': 'крепость' })
    const { result } = await mountSync()
    expect(result.current.progress?.id).toBe(42)

    await act(async () => {
      await result.current.resetProgress()
    })
    expect(result.current.progress).toBeNull()

    // Доставка очереди, начатая до сброса, подтвердилась после него.
    await confirmForeignWrite(withAnswers(mockEmptyRow(42), { 'step-1': 'крепость', 'step-2': 'вокзал' }))
    expect(result.current.progress).toBeNull()

    // Новое прохождение после сброса — строка нового поколения.
    await confirmForeignWrite(withAnswers(mockEmptyRow(57), { 'step-3': 'мост' }))
    expect(result.current.progress?.id).toBe(57)
    expect(result.current.progressMissing).toBe(false)
  })

  it('ответ своего флаша, пришедший после «Сбросить», экран не принимает', async () => {
    const { result } = await mountSync()
    expect(result.current.progressMissing).toBe(true)
    let acknowledge!: (row: ApiQuestProgress) => void
    mockUpdateProgress.mockImplementationOnce(() => new Promise<ApiQuestProgress>((resolve) => { acknowledge = resolve }))

    act(() => result.current.saveProgress(STARTED))
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    await flushMicrotasks()
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)

    // Строки экран ещё не знает: сброс удалять нечего, а запись уже в полёте.
    await act(async () => {
      await result.current.resetProgress()
    })
    acknowledge(withAnswers(mockEmptyRow(461), STARTED.answers))
    await flushMicrotasks()

    expect(result.current.progress).toBeNull()
  })

  it('ответ чтения, начатого до принятой записи, её не затирает', async () => {
    let answerRead!: (row: ApiQuestProgress | null) => void
    mockFetchQuestProgress.mockImplementationOnce(() => new Promise((resolve) => { answerRead = resolve }))
    const { result } = await mountSync()
    expect(result.current.progressLoading).toBe(true)

    const migrated = withAnswers(mockEmptyRow(461), { 'step-1': 'крепость', 'step-3': 'вокзал' })
    await confirmForeignWrite(migrated)
    expect(result.current.progress).toEqual(migrated)

    answerRead(mockEmptyRow(461))
    await flushMicrotasks()

    expect(result.current.progressLoading).toBe(false)
    expect(result.current.progress).toEqual(migrated)
    expect(result.current.progressMissing).toBe(false)
  })

  it('запись другого квеста экран не трогает', async () => {
    const { result } = await mountSync()
    act(() => syncQuestProgressReaders('minsk-cmok', 'A', withAnswers(mockEmptyRow(88), { 'step-1': 'цмок' })))
    await flushMicrotasks()
    expect(result.current.progress).toBeNull()
    expect(result.current.progressMissing).toBe(true)
  })
})
