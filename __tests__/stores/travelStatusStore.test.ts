// FE-ARCH D1 #994 — travelStatus на React Query (замена Zustand-стора).
// Тестируем новый контракт модуля через реальный QueryClient: оптимистичные
// setTravelStatus/removeTravelStatus + серверный upsert/delete с откатом,
// loadTravelStatus (серверные явные статусы + авторские путешествия, деривация,
// модерация, offline), identity-isolation по userId, и чистые хелперы.

// setup.ts глобально стабит travelStatusStore — здесь нужен реальный модуль.
jest.unmock('@/stores/travelStatusStore')

import { QueryClient } from '@tanstack/react-query'

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: jest.fn(),
}))

jest.mock('@/api/user', () => ({
  fetchUserTravelStatuses: jest.fn(() => Promise.resolve([])),
  upsertUserTravelStatus: jest.fn(() => Promise.resolve({
    travel_id: 1,
    status: 'planned',
    planned_date: null,
    visited_date: null,
    added_at: '2026-05-20T10:00:00Z',
    updated_at: null,
  })),
  deleteUserTravelStatus: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@/api/travelUserQueries', () => ({
  fetchMyTravels: jest.fn(() => Promise.resolve({ data: [], total: 0 })),
  unwrapMyTravelsPayload: jest.fn((payload: any) => {
    if (Array.isArray(payload)) return { items: payload, total: payload.length, engagementSummary: null }
    if (Array.isArray(payload?.data)) {
      return { items: payload.data, total: Number(payload.total ?? payload.count ?? payload.data.length), engagementSummary: null }
    }
    if (Array.isArray(payload?.results)) {
      return { items: payload.results, total: Number(payload.count ?? payload.total ?? payload.results.length), engagementSummary: null }
    }
    return { items: [], total: Number(payload?.total ?? payload?.count ?? 0), engagementSummary: null }
  }),
}))

import {
  getTravelStatus,
  setTravelStatus,
  removeTravelStatus,
  loadTravelStatus,
  getTravelStatusCalendarDate,
  parseTravelStatusDateParts,
} from '@/stores/travelStatusStore'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import { queryKeys } from '@/api/queryKeys'
import { setActiveQueryClient } from '@/api/activeQueryClient'

const { fetchUserTravelStatuses, upsertUserTravelStatus, deleteUserTravelStatus } = require('@/api/user') as {
  fetchUserTravelStatuses: jest.Mock
  upsertUserTravelStatus: jest.Mock
  deleteUserTravelStatus: jest.Mock
}
const { fetchMyTravels } = require('@/api/travelUserQueries') as { fetchMyTravels: jest.Mock }

const getIsoDayOfWeek = (date: string | undefined) => {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

const makeEntry = (
  id: number | string,
  status: TravelStatusEntry['status'] = 'wishlist',
  extra?: Partial<TravelStatusEntry>
): Omit<TravelStatusEntry, 'addedAt'> => ({
  id,
  type: 'travel',
  title: `Travel ${id}`,
  url: `/travels/${id}`,
  status,
  ...extra,
})

let qc: QueryClient
const entriesOf = (userId: string | null): TravelStatusEntry[] =>
  qc.getQueryData<TravelStatusEntry[]>(queryKeys.travelStatus(userId)) ?? []

beforeEach(() => {
  jest.clearAllMocks()
  upsertUserTravelStatus.mockResolvedValue({
    travel_id: 1, status: 'planned', planned_date: null, visited_date: null,
    added_at: '2026-05-20T10:00:00Z', updated_at: null,
  })
  deleteUserTravelStatus.mockResolvedValue(null)
  fetchUserTravelStatuses.mockResolvedValue([])
  fetchMyTravels.mockResolvedValue({ data: [], total: 0 })
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  setActiveQueryClient(qc)
})

afterEach(() => setActiveQueryClient(null))

describe('setTravelStatus', () => {
  it('добавляет новую запись', async () => {
    await setTravelStatus(makeEntry(1, 'wishlist'), null)
    const entries = entriesOf(null)
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe(1)
    expect(entries[0].addedAt).toBeGreaterThan(0)
  })

  it('обновляет существующую запись, сохраняя addedAt', async () => {
    await setTravelStatus(makeEntry(1, 'wishlist'), null)
    const addedAt = entriesOf(null)[0].addedAt
    await setTravelStatus(makeEntry(1, 'visited'), null)
    const entries = entriesOf(null)
    expect(entries).toHaveLength(1)
    expect(entries[0].status).toBe('visited')
    expect(entries[0].addedAt).toBe(addedAt)
  })

  it('сохраняет plannedDate для статуса planned', async () => {
    await setTravelStatus(makeEntry(1, 'planned', { plannedDate: '2026-07-15' }), null)
    expect(entriesOf(null)[0].plannedDate).toBe('2026-07-15')
  })

  it('сохраняет visitedDate для статуса visited', async () => {
    await setTravelStatus(makeEntry(1, 'visited', { visitedDate: '2026-05-12' }), null)
    expect(entriesOf(null)[0].visitedDate).toBe('2026-05-12')
  })

  it('сохраняет wishlistDate для статуса wishlist', async () => {
    await setTravelStatus(makeEntry(1, 'wishlist', { wishlistDate: '2026-09-01' }), null)
    expect(entriesOf(null)[0].wishlistDate).toBe('2026-09-01')
  })

  it('сохраняет год и месяц путешествия для календарного fallback', async () => {
    await setTravelStatus(
      makeEntry(1, 'visited', { travelYear: '2024', travelMonth: ['9'], travelMonthName: 'Сентябрь' }),
      null,
    )
    const entry = entriesOf(null)[0]
    expect(entry.travelYear).toBe('2024')
    expect(entry.travelMonth).toEqual(['9'])
  })

  it('scopes записи по userId (identity-isolation)', async () => {
    await setTravelStatus(makeEntry(1, 'visited'), null)
    await setTravelStatus(makeEntry(2, 'planned', { plannedDate: '2026-06-01' }), '42')
    expect(entriesOf(null).map((e) => e.id)).toEqual([1])
    expect(entriesOf('42').map((e) => e.id)).toEqual([2])
  })

  it('отправляет статус авторизованного пользователя на backend', async () => {
    await setTravelStatus(makeEntry(123, 'planned', { plannedDate: '2026-07-15' }), '42')
    expect(upsertUserTravelStatus).toHaveBeenCalledWith('42', expect.objectContaining({
      travel_id: 123, status: 'planned', planned_date: '2026-07-15',
    }))
  })

  it('гость не дёргает backend', async () => {
    await setTravelStatus(makeEntry(1, 'visited'), null)
    expect(upsertUserTravelStatus).not.toHaveBeenCalled()
  })

  it('откатывает optimistic update, если backend не сохранил статус', async () => {
    await setTravelStatus(makeEntry(1, 'wishlist'), '42')
    upsertUserTravelStatus.mockRejectedValueOnce(new Error('boom'))
    await expect(
      setTravelStatus(makeEntry(123, 'planned', { plannedDate: '2026-07-15' }), '42'),
    ).rejects.toThrow('boom')
    expect(entriesOf('42').map((entry) => entry.id)).toEqual([1])
  })

  it('не дублирует записи при повторном вызове', async () => {
    await setTravelStatus(makeEntry(5, 'wishlist'), '42')
    await setTravelStatus(makeEntry(5, 'planned', { plannedDate: '2026-08-01' }), '42')
    expect(entriesOf('42')).toHaveLength(1)
    expect(entriesOf('42')[0].status).toBe('planned')
  })
})

describe('removeTravelStatus', () => {
  it('удаляет запись по id', async () => {
    await setTravelStatus(makeEntry(10, 'visited'), null)
    await removeTravelStatus(10, null)
    expect(entriesOf(null)).toHaveLength(0)
  })

  it('не падает при удалении несуществующего id', async () => {
    await expect(removeTravelStatus(999, null)).resolves.not.toThrow()
  })

  it('удаляет статус авторизованного пользователя на backend', async () => {
    await setTravelStatus(makeEntry(123, 'visited'), '42')
    await removeTravelStatus(123, '42')
    expect(deleteUserTravelStatus).toHaveBeenCalledWith('42', 123)
  })

  it('откатывает удаление, если backend не удалил статус', async () => {
    await setTravelStatus(makeEntry(123, 'visited'), '42')
    deleteUserTravelStatus.mockRejectedValueOnce(new Error('net'))
    await expect(removeTravelStatus(123, '42')).rejects.toThrow('net')
    expect(getTravelStatus('42', 123)).toBeDefined()
  })
})

describe('getTravelStatus', () => {
  it('возвращает запись по числовому id', async () => {
    await setTravelStatus(makeEntry(7, 'planned'), null)
    expect(getTravelStatus(null, 7)?.status).toBe('planned')
  })

  it('возвращает запись по строковому id', async () => {
    await setTravelStatus(makeEntry('abc', 'wishlist'), null)
    expect(getTravelStatus(null, 'abc')?.id).toBe('abc')
  })

  it('возвращает undefined для несуществующего id', () => {
    expect(getTravelStatus(null, 999)).toBeUndefined()
  })
})

describe('loadTravelStatus', () => {
  it('гость — no-op (persist держит локальные записи)', async () => {
    await loadTravelStatus(null)
    expect(fetchUserTravelStatuses).not.toHaveBeenCalled()
  })

  it('загружает серверные явные статусы авторизованного пользователя', async () => {
    fetchUserTravelStatuses.mockResolvedValueOnce([
      {
        travel_id: 123, status: 'planned', planned_date: '2026-07-15', visited_date: null,
        added_at: '2026-05-12T10:00:00Z', updated_at: '2026-05-12T10:00:00Z',
        travel: {
          id: 123, name: 'Alps hike', slug: 'alps-hike', url: '/travels/alps-hike',
          travel_image_thumb_url: 'https://example.com/alps.webp', countryName: 'Switzerland',
        },
      },
    ])

    await loadTravelStatus('77')

    expect(fetchUserTravelStatuses).toHaveBeenCalledWith('77', { perPage: 9999 })
    expect(entriesOf('77')).toEqual([
      expect.objectContaining({ id: 123, title: 'Alps hike', status: 'planned', plannedDate: '2026-07-15', url: '/travels/alps-hike' }),
    ])
  })

  it('сохраняет месяц и год из серверного travel для visited без точной даты', async () => {
    fetchUserTravelStatuses.mockResolvedValueOnce([
      {
        travel_id: 321, status: 'visited', planned_date: null, visited_date: null,
        added_at: '2026-05-12T10:00:00Z', updated_at: '2026-05-12T10:00:00Z',
        travel: {
          id: 321, name: 'September route', slug: 'september-route', url: '/travels/september-route',
          travel_image_thumb_url: 'https://example.com/september.webp', countryName: 'Belarus',
          year: 2024, month: [9], monthName: 'Сентябрь',
        },
      },
    ])

    await loadTravelStatus('77')

    const entry = entriesOf('77')[0]
    const date = getTravelStatusCalendarDate(entry)
    expect(entry).toEqual(expect.objectContaining({
      status: 'visited', visitedDate: undefined, travelYear: '2024', travelMonth: ['9'], travelMonthName: 'Сентябрь',
    }))
    expect(date).toMatch(/^2024-09-/)
    expect([0, 6]).toContain(getIsoDayOfWeek(date))
  })

  it('добавляет авторские путешествия как default visited и не дублирует explicit status', async () => {
    fetchUserTravelStatuses.mockResolvedValueOnce([
      {
        travel_id: 202, status: 'planned', planned_date: '2026-05-21', visited_date: null,
        added_at: '2026-05-12T10:00:00Z', updated_at: '2026-05-12T10:00:00Z',
        travel: {
          id: 202, name: 'Explicit planned', slug: 'explicit-planned', url: '/travels/explicit-planned',
          travel_image_thumb_url: '', countryName: 'Польша',
        },
      },
    ])
    fetchMyTravels.mockResolvedValueOnce({
      data: [
        { id: 101, name: 'Authored visited', slug: 'authored-visited', url: '/travels/authored-visited', travel_image_thumb_url: 'https://example.com/a.webp', countryName: 'Италия', year: 2024, month: [7], monthName: 'Июль' },
        { id: 202, name: 'Authored but planned', slug: 'explicit-planned', url: '/travels/explicit-planned', countryName: 'Польша', year: 2026, month: [5], monthName: 'Май' },
      ],
      total: 2,
    })

    await loadTravelStatus('77')

    expect(fetchMyTravels).toHaveBeenCalledWith({
      user_id: '77', page: 1, perPage: 9999, includeDrafts: true, throwOnError: true,
    })

    const entries = entriesOf('77')
    expect(entries).toHaveLength(2)
    const byId = Object.fromEntries(entries.map((entry) => [String(entry.id), entry]))
    expect(byId['101']).toEqual(expect.objectContaining({
      status: 'visited', title: 'Authored visited', url: '/travels/authored-visited', travelYear: '2024', travelMonth: ['7'], travelMonthName: 'Июль',
    }))
    expect(getTravelStatusCalendarDate(byId['101'])).toMatch(/^2024-07-/)
    expect(byId['202']).toEqual(expect.objectContaining({
      status: 'planned', plannedDate: '2026-05-21', title: 'Explicit planned', travelYear: '2026', travelMonth: ['5'], travelMonthName: 'Май',
    }))
  })

  it('авторское путешествие с будущим годом попадает в «Планирую»', async () => {
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 501, name: 'Future trip', slug: 'future-trip', countryName: 'Испания', year: 2100, month: [6], monthName: 'Июнь' }],
      total: 1,
    })
    await loadTravelStatus('77')
    const entry = entriesOf('77')[0]
    expect(entry.status).toBe('planned')
    expect(getTravelStatusCalendarDate(entry)).toMatch(/^2100-06-/)
  })

  it('авторское путешествие с явной будущей датой кладёт её в plannedDate', async () => {
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 502, name: 'Explicit future', slug: 'explicit-future', countryName: 'Грузия', visited_date: '2099-09-09' }],
      total: 1,
    })
    await loadTravelStatus('77')
    const entry = entriesOf('77')[0]
    expect(entry.status).toBe('planned')
    expect(entry.plannedDate).toBe('2099-09-09')
    expect(entry.visitedDate).toBeUndefined()
  })

  it('помечает черновик (publish=0) moderationState=draft', async () => {
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 601, name: 'Draft trip', slug: 'draft-trip', countryName: 'Литва', year: 2024, month: [4], monthName: 'Апрель', publish: 0, moderation: 0 }],
      total: 1,
    })
    await loadTravelStatus('77')
    const entry = entriesOf('77')[0]
    expect(entry.status).toBe('visited')
    expect(entry.moderationState).toBe('draft')
  })

  it('помечает непромодерированное (publish=1, moderation=0) moderationState=pending', async () => {
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 602, name: 'Pending trip', slug: 'pending-trip', countryName: 'Латвия', year: 2024, month: [3], monthName: 'Март', publish: 1, moderation: 0 }],
      total: 1,
    })
    await loadTravelStatus('77')
    expect(entriesOf('77')[0].moderationState).toBe('pending')
  })

  it('не помечает опубликованное (publish=1, moderation=1) — moderationState undefined', async () => {
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 603, name: 'Published trip', slug: 'published-trip', countryName: 'Эстония', year: 2024, month: [2], monthName: 'Февраль', publish: 1, moderation: 1 }],
      total: 1,
    })
    await loadTravelStatus('77')
    expect(entriesOf('77')[0].moderationState).toBeUndefined()
  })

  it('обогащает explicit visited без даты годом и месяцем из авторского списка', async () => {
    fetchUserTravelStatuses.mockResolvedValueOnce([
      {
        travel_id: 303, status: 'visited', planned_date: null, visited_date: null,
        added_at: '2026-05-12T10:00:00Z', updated_at: '2026-05-12T10:00:00Z',
        travel: { id: 303, name: 'Server status without period', slug: 'server-status-without-period', url: '/travels/server-status-without-period', travel_image_thumb_url: '', countryName: 'Беларусь' },
      },
    ])
    fetchMyTravels.mockResolvedValueOnce({
      data: [{ id: 303, name: 'Authored metadata source', slug: 'server-status-without-period', countryName: 'Беларусь', year: '2025', month: [8], monthName: 'Август' }],
      total: 1,
    })

    await loadTravelStatus('77')

    const entry = entriesOf('77')[0]
    const date = getTravelStatusCalendarDate(entry)
    expect(entry).toEqual(expect.objectContaining({
      status: 'visited', title: 'Server status without period', travelYear: '2025', travelMonth: ['8'], travelMonthName: 'Август',
    }))
    expect(date).toMatch(/^2025-08-/)
    expect([0, 6]).toContain(getIsoDayOfWeek(date))
  })

  it('не падает и сохраняет текущие статусы, если серверная синхронизация упала (offline)', async () => {
    // Локальные статусы = текущий кэш (persist-restored), сервер недоступен.
    qc.setQueryData(queryKeys.travelStatus('77'), [
      { id: 5, type: 'travel', title: 'Локальный поход', url: '/travels/5', status: 'visited', addedAt: 1 },
    ])
    fetchUserTravelStatuses.mockRejectedValueOnce(
      new Error('Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.')
    )

    await expect(loadTravelStatus('77')).resolves.not.toThrow()

    expect(entriesOf('77')).toEqual([
      expect.objectContaining({ id: 5, title: 'Локальный поход', status: 'visited' }),
    ])
  })
})

describe('parseTravelStatusDateParts', () => {
  it('валидирует реальную ISO-дату', () => {
    expect(parseTravelStatusDateParts('2026-05-12')).toEqual({ year: 2026, month: 5, day: 12 })
  })

  it('отклоняет невозможные календарные даты', () => {
    expect(parseTravelStatusDateParts('2026-02-31')).toBeNull()
    expect(parseTravelStatusDateParts('2026-13-01')).toBeNull()
    expect(parseTravelStatusDateParts('2026-00-01')).toBeNull()
  })
})
