// #1922: очередь доставки прогресса квеста. Прохождение без сети до этой
// очереди жило в ref-е экрана: уход с квеста делал одну попытку отправки и
// чистил её, и час ходьбы оставался на телефоне. Проверяем ровно то, из-за чего
// прохождение терялось: запись переживает выгрузку приложения, уезжает без
// открытия экрана квеста и не выбрасывается, когда отправлять пока некому.
import AsyncStorage from '@react-native-async-storage/async-storage'

const mockWithQuestProgress = jest.fn()
const mockUpdateProgress = jest.fn()

jest.mock('@/api/quests', () => ({
  withQuestProgress: (...args: any[]) => mockWithQuestProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
}))

const mockAuthState = { isAuthenticated: true, userId: 169 }

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}))

jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: () => null }))
jest.mock('@/api/questsCatalogInvalidation', () => ({ refreshQuestsCatalogCompletion: jest.fn() }))

import { ApiError } from '@/api/clientErrors'
import {
  QUEST_PROGRESS_QUEUE_KEY,
  __resetQuestProgressQueue,
  deliverOrEnqueueQuestProgress,
  dequeueQuestProgress,
  enqueueQuestProgress,
  flushQuestProgressQueue,
  getQueuedQuestIds,
  subscribeQuestProgressQueue,
} from '@/utils/questProgressQueue'

/** Снапшот пройденного офлайн квеста — то, что должно доехать до сервера. */
const offlineRun = (overrides: Record<string, unknown> = {}) => ({
  currentIndex: 4,
  unlockedIndex: 4,
  answers: { intro: 'start', '1-spider': 'паук' },
  attempts: { '1-spider': 1 },
  hints: {},
  showMap: true,
  completed: true,
  skipped: {},
  earlyFinish: false,
  updatedAt: 1_757_000_000_000,
  answeredAt: { '1-spider': 1_757_000_000_000 },
  ...overrides,
})

const serverRow = { id: 77, completed: false, updated_at: null } as any

const readStoredQueue = async (): Promise<any[]> => {
  const raw = await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

beforeEach(async () => {
  __resetQuestProgressQueue()
  await AsyncStorage.clear()
  mockAuthState.isAuthenticated = true
  mockAuthState.userId = 169
  mockWithQuestProgress.mockReset()
  mockUpdateProgress.mockReset()
  // Реальный `withQuestProgress` отдаёт задаче существующую или только что
  // созданную серверную строку — здесь она всегда есть.
  mockWithQuestProgress.mockImplementation(async (_questId: string, task: any) => task(serverRow))
  mockUpdateProgress.mockImplementation(async (id: number, payload: any) => ({
    ...serverRow,
    id,
    ...payload,
  }))
})

afterEach(() => {
  __resetQuestProgressQueue()
})

describe('очередь прогресса переживает выгрузку приложения', () => {
  it('кладёт снапшот на диск и отдаёт его после перезапуска, без открытия экрана квеста', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())

    const stored = await readStoredQueue()
    expect(stored).toHaveLength(1)
    expect(stored[0].questId).toBe('ojcow-lokietek')
    expect(stored[0].snapshot.answers['1-spider']).toBe('паук')

    // Перезапуск приложения: модульное состояние пустое, на диске — очередь.
    __resetQuestProgressQueue()
    await flushQuestProgressQueue()

    expect(mockWithQuestProgress).toHaveBeenCalledTimes(1)
    expect(mockWithQuestProgress.mock.calls[0][0]).toBe('ojcow-lokietek')
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(mockUpdateProgress.mock.calls[0][1]).toMatchObject({
      completed: true,
      answers: { intro: 'start', '1-spider': 'паук' },
    })
    expect(await readStoredQueue()).toHaveLength(0)
  })

  it('повторная постановка того же квеста сливается в одну запись и не теряет ответов', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ completed: false, answers: { intro: 'start' } }))
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())

    const stored = await readStoredQueue()
    expect(stored).toHaveLength(1)
    expect(stored[0].snapshot.answers).toMatchObject({ intro: 'start', '1-spider': 'паук' })
    expect(stored[0].snapshot.completed).toBe(true)
  })
})

describe('очередь не выбрасывается, пока отправлять некому', () => {
  it('без авторизации ничего не шлёт и запись сохраняет — она ждёт входа', async () => {
    mockAuthState.isAuthenticated = false

    // Так уходит с квеста экран, когда токена уже нет (#1921): снапшот кладётся
    // в очередь, а не выбрасывается.
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())
    await flushQuestProgressQueue()

    expect(mockWithQuestProgress).not.toHaveBeenCalled()
    expect(await readStoredQueue()).toHaveLength(1)

    // Вход в аккаунт — то же прохождение уезжает без открытия экрана квеста.
    mockAuthState.isAuthenticated = true
    await flushQuestProgressQueue()

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(await readStoredQueue()).toHaveLength(0)
  })

  it('офлайн оставляет запись в очереди, а вернувшаяся сеть её увозит', async () => {
    mockWithQuestProgress.mockRejectedValueOnce(new Error('Network request failed'))

    await deliverOrEnqueueQuestProgress('ojcow-lokietek', offlineRun())
    expect(await readStoredQueue()).toHaveLength(1)

    mockWithQuestProgress.mockImplementation(async (_questId: string, task: any) => task(serverRow))
    await flushQuestProgressQueue()

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(await readStoredQueue()).toHaveLength(0)
  })

  it('снимает запись, которую сервер никогда не примет, чтобы она не заткнула очередь', async () => {
    await enqueueQuestProgress('broken-quest', offlineRun())
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())
    mockWithQuestProgress.mockImplementationOnce(async () => {
      throw new ApiError(404, 'Not found')
    })

    await flushQuestProgressQueue()

    expect(getQueuedQuestIds()).toEqual([])
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
  })
})

describe('пометка «ещё не отправлено»', () => {
  it('подписчик видит квест в очереди и его исчезновение после доставки', async () => {
    const seen: string[][] = []
    const unsubscribe = subscribeQuestProgressQueue((questIds) => seen.push(questIds))

    await enqueueQuestProgress('ojcow-lokietek', offlineRun())
    expect(seen[seen.length - 1]).toEqual(['ojcow-lokietek'])

    await flushQuestProgressQueue()
    expect(seen[seen.length - 1]).toEqual([])

    unsubscribe()
  })

  it('успешная отправка экраном снимает квест с очереди', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())
    await dequeueQuestProgress('ojcow-lokietek')

    expect(getQueuedQuestIds()).toEqual([])
    expect(await readStoredQueue()).toHaveLength(0)
  })
})
