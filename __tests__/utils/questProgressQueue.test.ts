// #1922: очередь доставки прогресса квеста. Прохождение без сети до этой
// очереди жило в ref-е экрана: уход с квеста делал одну попытку отправки и
// чистил её, и час ходьбы оставался на телефоне. Проверяем ровно то, из-за чего
// прохождение терялось: запись переживает выгрузку приложения, уезжает без
// открытия экрана квеста и не выбрасывается, когда отправлять пока некому.
import AsyncStorage from '@react-native-async-storage/async-storage'

const mockWithQuestProgress = jest.fn()
const mockUpdateProgress = jest.fn()
const mockDeleteProgress = jest.fn()

jest.mock('@/api/quests', () => ({
  withQuestProgress: (...args: any[]) => mockWithQuestProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
}))

const mockAuthState = { isAuthenticated: true, userId: '169' }

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}))

jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: () => null }))
jest.mock('@/api/questsCatalogInvalidation', () => ({ refreshQuestsCatalogCompletion: jest.fn() }))

import { ApiError } from '@/api/clientErrors'
import { QuestProgressLineageMismatch } from '@/utils/questProgressMerge'
import {
  QUEST_PROGRESS_DELETIONS_KEY,
  QUEST_PROGRESS_QUEUE_KEY,
  __resetQuestProgressQueue,
  deleteOrEnqueueQuestProgress,
  deliverOrEnqueueQuestProgress,
  dequeueDeliveredQuestProgress,
  dequeueQuestProgress,
  dropEndedQuestProgressRuns,
  enqueueQuestProgress,
  flushQuestProgressQueue,
  getQueuedQuestIds,
  settleQuestProgressDeletions,
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
  mockAuthState.userId = '169'
  mockWithQuestProgress.mockReset()
  mockUpdateProgress.mockReset()
  mockDeleteProgress.mockReset()
  mockDeleteProgress.mockResolvedValue(undefined)
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

describe('запись принадлежит своему игроку', () => {
  // #1456: ответы одного игрока не имеют права уехать в прохождение другого.
  // Локальная копия держит владельца в ключе по той же причине.
  it('после смены аккаунта чужая запись не уезжает и остаётся ждать своего входа', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun())

    mockAuthState.userId = '186'
    await flushQuestProgressQueue()

    expect(mockWithQuestProgress).not.toHaveBeenCalled()
    expect(await readStoredQueue()).toHaveLength(1)

    // Вернулся владелец — его прохождение уезжает.
    mockAuthState.userId = '169'
    await flushQuestProgressQueue()

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(await readStoredQueue()).toHaveLength(0)
  })

  it('прохождения двух игроков по одному квесту не сливаются в одну запись', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ answers: { intro: 'start', '1-spider': 'паук' } }))
    mockAuthState.userId = '186'
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ answers: { intro: 'start' }, completed: false }))

    const stored = await readStoredQueue()
    expect(stored).toHaveLength(2)
    expect(stored.map((entry: any) => entry.ownerId).sort()).toEqual(['169', '186'])

    // Уезжает только запись вошедшего игрока.
    await flushQuestProgressQueue()
    const left = await readStoredQueue()
    expect(left).toHaveLength(1)
    expect(left[0].ownerId).toBe('169')
  })
})

describe('копия сброшенного прохождения не воскрешает его (#2033)', () => {
  /** Настоящий `withQuestProgress`: строки поколения 100 больше нет. */
  const resetElsewhere = async (questId: string, task: any, options?: { lineageId?: number }) => {
    if (options?.lineageId) throw new QuestProgressLineageMismatch(questId, options.lineageId, null)
    return task(serverRow)
  }

  it('отправка передаёт писателю поколение снапшота', async () => {
    await deliverOrEnqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))

    expect(mockWithQuestProgress.mock.calls[0][2]).toEqual({ lineageId: 100 })
  })

  it('проход очереди выбрасывает запись сброшенного прохождения и везёт остальные', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))
    await enqueueQuestProgress('krakow-dragon', offlineRun())
    mockWithQuestProgress.mockImplementation(resetElsewhere)

    await flushQuestProgressQueue()

    expect(await readStoredQueue()).toEqual([])
    // PATCH ушёл только прохождению без поколения — в его строку.
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
    expect(mockWithQuestProgress.mock.calls.map((call) => call[0])).toEqual(['ojcow-lokietek', 'krakow-dragon'])
  })

  it('уход с экрана не кладёт копию сброшенного прохождения в очередь и снимает лежащую', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))
    mockWithQuestProgress.mockImplementation(resetElsewhere)

    await deliverOrEnqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))

    expect(await readStoredQueue()).toEqual([])
    expect(mockUpdateProgress).not.toHaveBeenCalled()
  })

  it('снапшот нового прохождения в очереди переживает выброс копии сброшенного', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 105, completed: false }))
    mockWithQuestProgress.mockImplementation(resetElsewhere)

    await deliverOrEnqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))

    const [entry] = await readStoredQueue()
    expect(entry.snapshot.serverId).toBe(105)
  })

  it('новый снапшот другого поколения вытесняет лежащую запись целиком', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))
    await enqueueQuestProgress(
      'ojcow-lokietek',
      offlineRun({ serverId: 105, completed: false, answers: { intro: 'start' } }),
    )

    const [entry] = await readStoredQueue()
    expect(entry.snapshot.serverId).toBe(105)
    expect(entry.snapshot.completed).toBe(false)
    expect(entry.snapshot.answers).toEqual({ intro: 'start' })
  })
})

// #2043: «Сбросить» без сети — `DELETE` падал, повтора не было, и новое
// прохождение сливалось в строку сброшенного вместе с «Пройден».
describe('намерение удалить строку при «Сбросить» без сети (#2043)', () => {
  const offlineError = () => new ApiError(0, 'offline', { offline: true })
  const readStoredDeletions = async (): Promise<any[]> =>
    JSON.parse((await AsyncStorage.getItem(QUEST_PROGRESS_DELETIONS_KEY)) ?? '[]')

  it('ложится на диск до запроса и снимается, когда сервер подтвердил удаление', async () => {
    let storedDuringRequest: any[] = []
    mockDeleteProgress.mockImplementationOnce(async () => {
      storedDuringRequest = await readStoredDeletions()
    })

    await expect(deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)).resolves.toBe(true)

    expect(storedDuringRequest).toEqual([
      expect.objectContaining({ questId: 'ojcow-lokietek', ownerId: '169', progressId: 42 }),
    ])
    expect(mockDeleteProgress).toHaveBeenCalledWith(42)
    expect(await readStoredDeletions()).toEqual([])
  })

  it('без сети остаётся, переживает перезапуск и уходит, когда сеть вернулась', async () => {
    mockDeleteProgress.mockRejectedValueOnce(offlineError())

    await expect(deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)).resolves.toBe(false)
    expect(await readStoredDeletions()).toHaveLength(1)

    // Перезапуск приложения: модульное состояние пустое, на диске — намерение.
    __resetQuestProgressQueue()
    await flushQuestProgressQueue()

    expect(mockDeleteProgress).toHaveBeenCalledTimes(2)
    expect(mockDeleteProgress).toHaveBeenLastCalledWith(42)
    expect(await readStoredDeletions()).toEqual([])
  })

  it('404 — строки уже нет: намерение закрыто и не повторяется', async () => {
    mockDeleteProgress.mockRejectedValueOnce(new ApiError(404, 'Not found'))

    await expect(deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)).resolves.toBe(true)
    await flushQuestProgressQueue()

    expect(mockDeleteProgress).toHaveBeenCalledTimes(1)
    expect(await readStoredDeletions()).toEqual([])
  })

  it('снапшот квеста не доходит до писателя, пока удаление ждёт, и уходит следом за ним', async () => {
    mockDeleteProgress.mockRejectedValue(offlineError())
    await deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)
    // Новое прохождение без поколения — то, что раньше сливалось в строку 42.
    const newRun = offlineRun({ completed: false, answers: { intro: 'start' } })

    await deliverOrEnqueueQuestProgress('ojcow-lokietek', newRun)
    await flushQuestProgressQueue()

    expect(mockWithQuestProgress).not.toHaveBeenCalled()
    expect(await readStoredQueue()).toHaveLength(1)

    mockDeleteProgress.mockResolvedValue(undefined)
    await flushQuestProgressQueue()

    expect(mockWithQuestProgress).toHaveBeenCalledTimes(1)
    const lastDelete = mockDeleteProgress.mock.invocationCallOrder[mockDeleteProgress.mock.invocationCallOrder.length - 1]
    expect(lastDelete).toBeLessThan(mockWithQuestProgress.mock.invocationCallOrder[0])
    expect(await readStoredQueue()).toEqual([])
    expect(await readStoredDeletions()).toEqual([])
  })

  it('ждущее удаление другого квеста путь к строке этого квеста не закрывает', async () => {
    mockDeleteProgress.mockRejectedValue(offlineError())
    await deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)

    await expect(settleQuestProgressDeletions('krakow-dragon')).resolves.toBe(true)
    await expect(settleQuestProgressDeletions('ojcow-lokietek')).resolves.toBe(false)
  })

  it('чужое намерение ждёт входа своего владельца', async () => {
    mockDeleteProgress.mockRejectedValueOnce(offlineError())
    await deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)

    mockAuthState.userId = '186'
    await enqueueQuestProgress('krakow-dragon', offlineRun())
    await flushQuestProgressQueue()

    // В чужой сессии сервер ответил бы 404 и закрыл намерение, не удалив строку.
    expect(mockDeleteProgress).toHaveBeenCalledTimes(1)
    expect(await readStoredDeletions()).toHaveLength(1)
    // Прохождения вошедшего игрока оно не держит.
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)

    mockAuthState.userId = '169'
    await flushQuestProgressQueue()

    expect(mockDeleteProgress).toHaveBeenCalledTimes(2)
    expect(await readStoredDeletions()).toEqual([])
  })

  it('постоянный отказ удаления снимает намерение и не затыкает очередь', async () => {
    mockDeleteProgress.mockRejectedValueOnce(offlineError())
    await deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)
    await enqueueQuestProgress('krakow-dragon', offlineRun())
    mockDeleteProgress.mockRejectedValueOnce(new ApiError(400, 'Bad request'))

    await flushQuestProgressQueue()

    expect(await readStoredDeletions()).toEqual([])
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1)
  })

  it('параллельные ожидающие делят одну попытку DELETE', async () => {
    mockDeleteProgress.mockRejectedValueOnce(offlineError())
    await deleteOrEnqueueQuestProgress('ojcow-lokietek', 42)
    let confirmDelete!: () => void
    mockDeleteProgress.mockImplementationOnce(() => new Promise<void>((resolve) => { confirmDelete = resolve }))

    const writer = settleQuestProgressDeletions('ojcow-lokietek')
    const reader = settleQuestProgressDeletions('ojcow-lokietek')
    await new Promise((resolve) => setTimeout(resolve, 0))
    confirmDelete()

    await expect(Promise.all([writer, reader])).resolves.toEqual([true, true])
    expect(mockDeleteProgress).toHaveBeenCalledTimes(2)
  })
})

// Хвост #2033 (R1): запись закончившегося поколения лежала в очереди до её
// пробуждения, и новое офлайн-прохождение, слившись в неё, наследовало её
// поколение и выбрасывалось вместе с ней.
describe('запись закончившегося поколения снимается при открытии квеста (#2043)', () => {
  it('подтверждённое отсутствие строки снимает запись поколения, новое прохождение ложится отдельно', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))
    await enqueueQuestProgress('krakow-dragon', offlineRun())

    await dropEndedQuestProgressRuns('ojcow-lokietek', '169', null)
    expect((await readStoredQueue()).map((entry: any) => entry.questId)).toEqual(['krakow-dragon'])

    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ completed: false, answers: { intro: 'start' } }))
    const entry = (await readStoredQueue()).find((candidate: any) => candidate.questId === 'ojcow-lokietek')
    expect(entry.snapshot).toMatchObject({ serverId: 0, completed: false, answers: { intro: 'start' } })
  })

  it('запись живого поколения, копия без поколения и чужая запись остаются', async () => {
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 100 }))
    await enqueueQuestProgress('krakow-dragon', offlineRun())
    mockAuthState.userId = '186'
    await enqueueQuestProgress('ojcow-lokietek', offlineRun({ serverId: 90 }))

    await dropEndedQuestProgressRuns('ojcow-lokietek', '169', 100)
    await dropEndedQuestProgressRuns('krakow-dragon', '169', null)

    expect(await readStoredQueue()).toHaveLength(3)
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

  // #2048: запись — не всегда подмножество снапшота экрана (туда уходит и
  // упавшая миграция гостя). Экран снимает только то, что ответ сервера покрыл.
  it('доставка экраном снимает запись, покрытую ответом сервера, и оставляет непокрытую', async () => {
    const run = offlineRun()
    const serverRow = {
      id: 7,
      current_index: 6,
      unlocked_index: 6,
      answers: { ...run.answers, '2-bridge': 'мост' },
      attempts: run.attempts,
      hints: {},
      show_map: false,
      completed: true,
      skipped: {},
      early_finish: false,
    }

    await enqueueQuestProgress('ojcow-lokietek', run)
    // Курсор и карта у сервера другие — это не делает запись непокрытой.
    await dequeueDeliveredQuestProgress('ojcow-lokietek', serverRow as any)
    expect(getQueuedQuestIds()).toEqual([])

    await enqueueQuestProgress('ojcow-lokietek', run)
    await dequeueDeliveredQuestProgress('ojcow-lokietek', { ...serverRow, answers: { intro: 'start' } } as any)
    expect(getQueuedQuestIds()).toEqual(['ojcow-lokietek'])
  })
})
