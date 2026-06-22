import { act } from '@testing-library/react'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: jest.fn(),
}))

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParseString: jest.fn((text: string, fallback: any) => {
    try {
      return JSON.parse(text)
    } catch {
      return fallback
    }
  }),
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

import { getTravelStatusCalendarDate, parseTravelStatusDateParts, useTravelStatusStore } from '@/stores/travelStatusStore'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

const { fetchUserTravelStatuses, upsertUserTravelStatus, deleteUserTravelStatus } = require('@/api/user') as {
  fetchUserTravelStatuses: jest.Mock
  upsertUserTravelStatus: jest.Mock
  deleteUserTravelStatus: jest.Mock
}

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

beforeEach(() => {
  jest.clearAllMocks()
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
  upsertUserTravelStatus.mockResolvedValue({
    travel_id: 1,
    status: 'planned',
    planned_date: null,
    visited_date: null,
    added_at: '2026-05-20T10:00:00Z',
    updated_at: null,
  })
  deleteUserTravelStatus.mockResolvedValue(null)
  fetchUserTravelStatuses.mockResolvedValue([])
  useTravelStatusStore.setState({ entries: [], _userId: null })
})

describe('travelStatusStore', () => {
  describe('начальное состояние', () => {
    it('entries пусты, _userId null', () => {
      const s = useTravelStatusStore.getState()
      expect(s.entries).toEqual([])
      expect(s._userId).toBeNull()
    })
  })

  describe('setStatus', () => {
    it('добавляет новую запись', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'wishlist'), null))
      const entries = useTravelStatusStore.getState().entries
      expect(entries).toHaveLength(1)
      expect(entries[0].id).toBe(1)
      expect(entries[0].status).toBe('wishlist')
      expect(entries[0].addedAt).toBeGreaterThan(0)
    })

    it('обновляет существующую запись, сохраняя addedAt', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'wishlist'), null))
      const addedAt = useTravelStatusStore.getState().entries[0].addedAt

      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'visited'), null))
      const entries = useTravelStatusStore.getState().entries
      expect(entries).toHaveLength(1)
      expect(entries[0].status).toBe('visited')
      expect(entries[0].addedAt).toBe(addedAt)
    })

    it('сохраняет plannedDate для статуса planned', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(2, 'planned', { plannedDate: '2026-07-15' }),
          null
        )
      )
      const entry = useTravelStatusStore.getState().entries[0]
      expect(entry.plannedDate).toBe('2026-07-15')
    })

    it('сохраняет visitedDate для статуса visited', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(3, 'visited', { visitedDate: '2026-05-12' }),
          null
        )
      )
      expect(useTravelStatusStore.getState().entries[0].visitedDate).toBe('2026-05-12')
    })

    it('сохраняет wishlistDate для статуса wishlist', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(4, 'wishlist', { wishlistDate: '2026-09-01' }),
          null
        )
      )
      expect(useTravelStatusStore.getState().entries[0].wishlistDate).toBe('2026-09-01')
    })

    it('сохраняет год и месяц путешествия для календарного fallback', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(6, 'visited', { travelYear: '2024', travelMonthName: 'Май' }),
          null
        )
      )
      const entry = useTravelStatusStore.getState().entries[0]
      const date = getTravelStatusCalendarDate(entry)
      expect(date).toMatch(/^2024-05-/)
      expect([0, 6]).toContain(getIsoDayOfWeek(date))
    })

    it('персистирует в AsyncStorage без userId', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'visited'), null))
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_travel_status',
        expect.any(String)
      )
    })

    it('использует ключ с userId', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'visited'), '42'))
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_travel_status_42',
        expect.any(String)
      )
    })

    it('отправляет статус авторизованного пользователя на backend', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(123, 'planned', { plannedDate: '2026-07-15' }),
          '42'
        )
      )

      expect(upsertUserTravelStatus).toHaveBeenCalledWith('42', {
        travel_id: 123,
        status: 'planned',
        planned_date: '2026-07-15',
        visited_date: null,
      })
    })

    it('откатывает optimistic update, если backend не сохранил статус', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'wishlist'), null))
      upsertUserTravelStatus.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        useTravelStatusStore.getState().setStatus(makeEntry(123, 'planned', { plannedDate: '2026-07-15' }), '42')
      ).rejects.toThrow('Network error')

      expect(useTravelStatusStore.getState().entries.map((entry) => entry.id)).toEqual([1])
    })

    it('не дублирует записи при повторном вызове', async () => {
      const userId = 'u1'
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(5, 'wishlist'), userId))
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(5, 'planned', { plannedDate: '2026-08-01' }), userId))
      expect(useTravelStatusStore.getState().entries).toHaveLength(1)
      expect(useTravelStatusStore.getState().entries[0].status).toBe('planned')
    })
  })

  describe('removeStatus', () => {
    it('удаляет запись по id', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(10, 'visited'), null))
      await act(() => useTravelStatusStore.getState().removeStatus(10, null))
      expect(useTravelStatusStore.getState().entries).toHaveLength(0)
    })

    it('не падает при удалении несуществующего id', async () => {
      await expect(
        act(() => useTravelStatusStore.getState().removeStatus(999, null))
      ).resolves.not.toThrow()
    })

    it('персистирует обновлённый массив в AsyncStorage', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'visited'), null))
      ;(AsyncStorage.setItem as jest.Mock).mockClear()
      await act(() => useTravelStatusStore.getState().removeStatus(1, null))
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('metravel_travel_status', '[]')
    })

    it('удаляет статус авторизованного пользователя на backend', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(123, 'visited'), null))

      await act(() => useTravelStatusStore.getState().removeStatus(123, '42'))

      expect(deleteUserTravelStatus).toHaveBeenCalledWith('42', 123)
    })

    it('откатывает удаление, если backend не удалил статус', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(123, 'visited'), null))
      deleteUserTravelStatus.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        useTravelStatusStore.getState().removeStatus(123, '42')
      ).rejects.toThrow('Network error')

      expect(useTravelStatusStore.getState().getStatus(123)).toBeDefined()
    })
  })

  describe('getStatus', () => {
    it('возвращает запись по числовому id', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(7, 'planned'), null))
      const entry = useTravelStatusStore.getState().getStatus(7)
      expect(entry).toBeDefined()
      expect(entry!.status).toBe('planned')
    })

    it('возвращает запись по строковому id', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry('abc', 'wishlist'), null))
      const entry = useTravelStatusStore.getState().getStatus('abc')
      expect(entry).toBeDefined()
    })

    it('возвращает undefined для несуществующего id', () => {
      expect(useTravelStatusStore.getState().getStatus(999)).toBeUndefined()
    })
  })

  describe('getByStatus', () => {
    it('фильтрует записи по статусу', async () => {
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(1, 'visited'), null))
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(2, 'planned', { plannedDate: '2026-06-01' }), null))
      await act(() => useTravelStatusStore.getState().setStatus(makeEntry(3, 'wishlist'), null))

      expect(useTravelStatusStore.getState().getByStatus('visited')).toHaveLength(1)
      expect(useTravelStatusStore.getState().getByStatus('planned')).toHaveLength(1)
      expect(useTravelStatusStore.getState().getByStatus('wishlist')).toHaveLength(1)
    })

    it('возвращает пустой массив при отсутствии совпадений', () => {
      expect(useTravelStatusStore.getState().getByStatus('visited')).toHaveLength(0)
    })
  })

  describe('getByMonth', () => {
    it('возвращает записи всех статусов с календарной датой в указанном месяце', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(1, 'planned', { plannedDate: '2026-07-15' }),
          null
        )
      )
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(2, 'visited', { visitedDate: '2026-07-20' }),
          null
        )
      )
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(3, 'wishlist', { wishlistDate: '2026-08-01' }),
          null
        )
      )

      const july = useTravelStatusStore.getState().getByMonth(2026, 7)
      expect(july.map((entry) => entry.id).sort()).toEqual([1, 2])

      const aug = useTravelStatusStore.getState().getByMonth(2026, 8)
      expect(aug).toHaveLength(1)
      expect(aug[0].id).toBe(3)

      const june = useTravelStatusStore.getState().getByMonth(2026, 6)
      expect(june).toHaveLength(0)
    })

    it('игнорирует planned без plannedDate', async () => {
      useTravelStatusStore.setState({
        entries: [{
          id: 99,
          type: 'travel',
          title: 'No date',
          url: '/travels/99',
          status: 'planned',
          addedAt: Date.now(),
        }],
      })
      expect(useTravelStatusStore.getState().getByMonth(2026, 7)).toHaveLength(0)
    })

    it('игнорирует некорректные даты без Date-нормализации', async () => {
      useTravelStatusStore.setState({
        entries: [{
          id: 100,
          type: 'travel',
          title: 'Invalid date',
          url: '/travels/100',
          status: 'planned',
          plannedDate: '2026-02-31',
          addedAt: Date.now(),
        }],
      })
      expect(useTravelStatusStore.getState().getByMonth(2026, 3)).toHaveLength(0)
      expect(useTravelStatusStore.getState().getByMonth(2026, 2)).toHaveLength(0)
    })
  })

  describe('loadLocal', () => {
    it('загружает записи из AsyncStorage', async () => {
      const stored: TravelStatusEntry[] = [
        { id: 1, type: 'travel', title: 'Trip A', url: '/travels/1', status: 'visited', addedAt: 1000 },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored))

      await act(() => useTravelStatusStore.getState().loadLocal(null))
      expect(useTravelStatusStore.getState().entries).toHaveLength(1)
      expect(useTravelStatusStore.getState().entries[0].title).toBe('Trip A')
    })

    it('использует user-scoped ключ при наличии userId', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      await act(() => useTravelStatusStore.getState().loadLocal('77'))
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('metravel_travel_status_77')
    })

    it('игнорирует некорректные записи из хранилища', async () => {
      const corrupt = JSON.stringify([
        { id: 1, type: 'travel', title: 'Good', url: '/t/1', status: 'visited', addedAt: 100 },
        { id: 2 }, // невалидная
        null,
      ])
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(corrupt)
      await act(() => useTravelStatusStore.getState().loadLocal(null))
      expect(useTravelStatusStore.getState().entries).toHaveLength(1)
    })

    it('очищает записи при пустом хранилище', async () => {
      useTravelStatusStore.setState({
        entries: [{ id: 1, type: 'travel', title: 'Stale', url: '/travels/1', status: 'planned', plannedDate: '2026-07-15', addedAt: 100 }],
        _userId: 'old',
      })
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      await act(() => useTravelStatusStore.getState().loadLocal(null))
      expect(useTravelStatusStore.getState().entries).toHaveLength(0)
    })

    it('устанавливает _userId', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      await act(() => useTravelStatusStore.getState().loadLocal('55'))
      expect(useTravelStatusStore.getState()._userId).toBe('55')
    })

    it('загружает серверные статусы авторизованного пользователя и сохраняет локальный кэш', async () => {
      fetchUserTravelStatuses.mockResolvedValueOnce([
        {
          travel_id: 123,
          status: 'planned',
          planned_date: '2026-07-15',
          visited_date: null,
          added_at: '2026-05-12T10:00:00Z',
          updated_at: '2026-05-12T10:00:00Z',
          travel: {
            id: 123,
            name: 'Alps hike',
            slug: 'alps-hike',
            url: '/travels/alps-hike',
            travel_image_thumb_url: 'https://example.com/alps.webp',
            countryName: 'Switzerland',
          },
        },
      ])

      await act(() => useTravelStatusStore.getState().loadLocal('77'))

      expect(fetchUserTravelStatuses).toHaveBeenCalledWith('77', { perPage: 9999 })
      expect(useTravelStatusStore.getState().entries).toEqual([
        expect.objectContaining({
          id: 123,
          title: 'Alps hike',
          status: 'planned',
          plannedDate: '2026-07-15',
          url: '/travels/alps-hike',
        }),
      ])
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
        'metravel_travel_status_77',
        expect.stringContaining('Alps hike')
      )
    })

    it('не падает и сохраняет локальные статусы, если серверная синхронизация упала (offline)', async () => {
      const stored = [
        { id: 5, type: 'travel', title: 'Локальный поход', url: '/travels/5', status: 'visited', addedAt: 1 },
      ]
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored))
      fetchUserTravelStatuses.mockRejectedValueOnce(
        new Error('Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.')
      )

      await expect(
        act(() => useTravelStatusStore.getState().loadLocal('77'))
      ).resolves.not.toThrow()

      expect(useTravelStatusStore.getState().entries).toEqual([
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
})
