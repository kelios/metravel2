import { act } from '@testing-library/react'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
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

import { useTravelStatusStore } from '@/stores/travelStatusStore'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

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
    it('возвращает только planned записи в указанном месяце', async () => {
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(1, 'planned', { plannedDate: '2026-07-15' }),
          null
        )
      )
      await act(() =>
        useTravelStatusStore.getState().setStatus(
          makeEntry(2, 'planned', { plannedDate: '2026-08-01' }),
          null
        )
      )
      await act(() =>
        useTravelStatusStore.getState().setStatus(makeEntry(3, 'visited'), null)
      )

      const july = useTravelStatusStore.getState().getByMonth(2026, 7)
      expect(july).toHaveLength(1)
      expect(july[0].id).toBe(1)

      const aug = useTravelStatusStore.getState().getByMonth(2026, 8)
      expect(aug).toHaveLength(1)
      expect(aug[0].id).toBe(2)

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

    it('ничего не делает при пустом хранилище', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      await act(() => useTravelStatusStore.getState().loadLocal(null))
      expect(useTravelStatusStore.getState().entries).toHaveLength(0)
    })

    it('устанавливает _userId', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
      await act(() => useTravelStatusStore.getState().loadLocal('55'))
      expect(useTravelStatusStore.getState()._userId).toBe('55')
    })
  })
})

