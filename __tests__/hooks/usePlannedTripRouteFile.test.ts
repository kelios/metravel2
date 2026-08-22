/**
 * #1496 — хуки исходного файла маршрута поездки.
 *
 * Что держит тест:
 *  1. закрытое хранилище (401/403/404) — это «оригинала нет», а не ошибка экрана:
 *     участник поездки обязан видеть обычный маршрут, а не красную плашку;
 *  2. геометрия берётся из скачанного файла и парсится целиком, без упрощения;
 *  3. ключ кэша трека включает ревизию файла — замена исходника сохраняет тот же
 *     id, и без ревизии на карте осталась бы геометрия прошлого трека.
 */
import { renderHook } from '@testing-library/react-native'

import {
  usePlannedTripOriginalTrack,
  usePlannedTripRouteFile,
} from '@/hooks/usePlannedTripRouteFile'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options: Record<string, unknown>) => ({ data: null, options })),
  useMutation: jest.fn((options: Record<string, unknown>) => ({ mutate: jest.fn(), options })),
  useQueryClient: jest.fn(() => ({ setQueryData: jest.fn(), invalidateQueries: jest.fn() })),
}))

jest.mock('@/api/plannedTripRoutes', () => ({
  fetchPlannedTripRouteFile: jest.fn(),
  downloadPlannedTripRouteFileBlob: jest.fn(),
  uploadPlannedTripRouteFile: jest.fn(),
  deletePlannedTripRouteFile: jest.fn(),
}))

// Класс объявляется ВНУТРИ фабрики: `jest.mock` поднимается выше объявлений
// модуля, и внешний `class` был бы в TDZ на момент вызова фабрики — хук получил
// бы `ApiError === undefined` и падал на `instanceof`.
jest.mock('@/api/client', () => {
  class ApiError extends Error {
    status: number
    constructor(status: number) {
      super(`status ${status}`)
      this.status = status
    }
  }
  return { ApiError }
})

const { ApiError: MockApiError } = jest.requireMock('@/api/client') as {
  ApiError: new (status: number) => Error
}
const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock }
const api = jest.requireMock('@/api/plannedTripRoutes') as {
  fetchPlannedTripRouteFile: jest.Mock
  downloadPlannedTripRouteFileBlob: jest.Mock
}

const storedFile = {
  id: 42,
  original_name: 'tatry.gpx',
  ext: 'gpx',
  size: 184392,
  created_at: '2026-08-18T21:45:00Z',
  updated_at: '2026-08-19T09:00:00Z',
}

const lastOptions = () => useQuery.mock.calls[useQuery.mock.calls.length - 1][0]

describe('usePlannedTripRouteFile', () => {
  beforeEach(() => {
    useQuery.mockClear()
    api.fetchPlannedTripRouteFile.mockReset()
    api.downloadPlannedTripRouteFileBlob.mockReset()
  })

  it('читает primary-файл поездки и включается только при известном id', async () => {
    api.fetchPlannedTripRouteFile.mockResolvedValue(storedFile)

    renderHook(() => usePlannedTripRouteFile(7))

    const options = lastOptions()
    expect(options.enabled).toBe(true)
    expect(options.queryKey).toEqual(['planned-trip-route-file', 7])
    await expect(options.queryFn()).resolves.toEqual(storedFile)

    renderHook(() => usePlannedTripRouteFile(null))
    expect(lastOptions().enabled).toBe(false)

    renderHook(() => usePlannedTripRouteFile(7, { enabled: false }))
    expect(lastOptions().enabled).toBe(false)
  })

  it.each([401, 403, 404, 501])('трактует %s как «оригинала нет», а не как ошибку', async (status) => {
    api.fetchPlannedTripRouteFile.mockRejectedValue(new MockApiError(status))

    renderHook(() => usePlannedTripRouteFile(7))

    await expect(lastOptions().queryFn()).resolves.toBeNull()
  })

  it('пробрасывает наверх настоящий отказ хранилища', async () => {
    api.fetchPlannedTripRouteFile.mockRejectedValue(new MockApiError(500))

    renderHook(() => usePlannedTripRouteFile(7))

    await expect(lastOptions().queryFn()).rejects.toBeInstanceOf(MockApiError)
  })
})

describe('usePlannedTripOriginalTrack', () => {
  beforeEach(() => {
    useQuery.mockClear()
    api.downloadPlannedTripRouteFileBlob.mockReset()
  })

  it('строит неупрощённую геометрию из скачанного файла', async () => {
    const trkpts = Array.from({ length: 200 }, (_, index) =>
      `<trkpt lat="${(49.2 + index * 0.0004).toFixed(6)}" lon="${(20.0 + index * 0.0005).toFixed(6)}"/>`,
    ).join('')
    api.downloadPlannedTripRouteFileBlob.mockResolvedValue({
      text: `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${trkpts}</trkseg></trk></gpx>`,
      contentType: 'application/gpx+xml',
    })

    renderHook(() => usePlannedTripOriginalTrack(7, storedFile))

    const track = await lastOptions().queryFn()
    expect(api.downloadPlannedTripRouteFileBlob).toHaveBeenCalledWith('7', 42)
    expect(track.geometry).toHaveLength(200)
    expect(track.sourcePointCount).toBe(200)
    expect(track.thinnedForDisplay).toBe(false)
  })

  it('включает ревизию файла в ключ кэша и выключается без файла', () => {
    renderHook(() => usePlannedTripOriginalTrack(7, storedFile))
    expect(lastOptions().queryKey).toEqual([
      'planned-trip-route-track',
      7,
      42,
      '2026-08-19T09:00:00Z',
    ])
    expect(lastOptions().enabled).toBe(true)

    // Замена файла сохраняет id — ключ обязан смениться по updated_at.
    renderHook(() =>
      usePlannedTripOriginalTrack(7, { ...storedFile, updated_at: '2026-08-20T10:00:00Z' }),
    )
    expect(lastOptions().queryKey[3]).toBe('2026-08-20T10:00:00Z')

    renderHook(() => usePlannedTripOriginalTrack(7, null))
    expect(lastOptions().enabled).toBe(false)
  })
})
