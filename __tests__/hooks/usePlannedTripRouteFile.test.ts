/**
 * #1496, #2069 — хуки исходных файлов маршрута поездки.
 *
 * Что держит тест:
 *  1. хук читает ВЕСЬ список файлов (#2069): бэкенд хранит до десяти (#1840), а
 *     сводка к первому прятала второй загруженный трек от карты и «Файла маршрута»;
 *  2. закрытое хранилище (401/403/404/501) — это «оригиналов нет», а не ошибка
 *     экрана: участник поездки обязан видеть обычный маршрут, а не красную плашку;
 *  3. геометрия берётся из каждого скачанного файла и парсится целиком, без
 *     упрощения; линии всех файлов идут на карту одним списком, не склеиваясь;
 *  4. трек кэшируется на файл (id + ревизия), а загрузка и удаление меняют в
 *     списке ровно свой файл — соседние остаются.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes'
import {
  useDeletePlannedTripRouteFile,
  usePlannedTripOriginalTracks,
  usePlannedTripRouteFiles,
  useUploadPlannedTripRouteFile,
} from '@/hooks/usePlannedTripRouteFile'
import { createQueryWrapper } from '../helpers/testQueryClient'

jest.mock('@/api/plannedTripRoutes', () => ({
  listPlannedTripRouteFiles: jest.fn(),
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
const api = jest.requireMock('@/api/plannedTripRoutes') as {
  listPlannedTripRouteFiles: jest.Mock
  downloadPlannedTripRouteFileBlob: jest.Mock
  uploadPlannedTripRouteFile: jest.Mock
  deletePlannedTripRouteFile: jest.Mock
}

// Как у trip 47 на проде: трёхпетлевой KML и добавленный к нему GPX по дням.
const loopsKml: PlannedTripRouteFile = {
  id: 4,
  original_name: 'Mullerthal_Trail_Routes_1-3.kml',
  ext: 'kml',
  size: 185548,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}
const daysGpx: PlannedTripRouteFile = {
  id: 11,
  original_name: 'Mullerthal_Trail_po_dnyam.gpx',
  ext: 'gpx',
  size: 412000,
  created_at: '2026-09-23T08:00:00Z',
  updated_at: '2026-09-23T08:05:00Z',
}

const KML_LOOP = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>6.42,49.81 6.43,49.82 6.44,49.81</coordinates></LineString></Placemark></Document></kml>`
const gpxDay = (points: number) => {
  const trkpts = Array.from({ length: points }, (_, index) =>
    `<trkpt lat="${(49.79 + index * 0.0004).toFixed(6)}" lon="${(6.3 + index * 0.0005).toFixed(6)}"/>`,
  ).join('')
  return `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${trkpts}</trkseg></trk></gpx>`
}

const BODIES: Record<number, string> = { 4: KML_LOOP, 11: gpxDay(200) }

describe('usePlannedTripRouteFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('отдаёт весь список файлов поездки в порядке бэкенда, а не первый', async () => {
    api.listPlannedTripRouteFiles.mockResolvedValue([loopsKml, daysGpx])
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePlannedTripRouteFiles(47), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.listPlannedTripRouteFiles).toHaveBeenCalledWith('47')
    expect(result.current.data?.map((file) => file.id)).toEqual([4, 11])
  })

  it('не ходит в хранилище без id поездки и при выключенном запросе', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => usePlannedTripRouteFiles(null), { wrapper: Wrapper })
    renderHook(() => usePlannedTripRouteFiles(47, { enabled: false }), { wrapper: Wrapper })

    expect(api.listPlannedTripRouteFiles).not.toHaveBeenCalled()
  })

  it.each([401, 403, 404, 501])('трактует %s как «оригиналов нет», а не как ошибку', async (status) => {
    api.listPlannedTripRouteFiles.mockRejectedValue(new MockApiError(status))
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePlannedTripRouteFiles(47), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('пробрасывает наверх настоящий отказ хранилища', async () => {
    api.listPlannedTripRouteFiles.mockRejectedValue(new MockApiError(500))
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePlannedTripRouteFiles(47), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(MockApiError)
  })
})

describe('usePlannedTripOriginalTracks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.downloadPlannedTripRouteFileBlob.mockImplementation(async (_tripId: string, routeId: number) => ({
      text: BODIES[routeId],
    }))
  })

  it('два файла — два трека: линии каждого файла целиком и в порядке списка', async () => {
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(
      () => usePlannedTripOriginalTracks(47, [loopsKml, daysGpx]),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(api.downloadPlannedTripRouteFileBlob).toHaveBeenCalledWith('47', 4)
    expect(api.downloadPlannedTripRouteFileBlob).toHaveBeenCalledWith('47', 11)
    const [loop, day] = result.current
    // Петля из KML — своя линия, [lng, lat].
    expect(loop).toEqual([
      [6.42, 49.81],
      [6.43, 49.82],
      [6.44, 49.81],
    ])
    // День из GPX — все 200 точек, без упрощения и без склейки с петлёй.
    expect(day).toHaveLength(200)
    expect(day[0]).toEqual([6.3, 49.79])
  })

  it('кэширует трек на файл по id и ревизии', async () => {
    const { Wrapper, queryClient } = createQueryWrapper()

    const { result } = renderHook(
      () => usePlannedTripOriginalTracks(47, [loopsKml, daysGpx]),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current).toHaveLength(2))
    const keys = queryClient.getQueryCache().getAll().map((query) => query.queryKey)
    expect(keys).toEqual(expect.arrayContaining([
      ['planned-trip-route-track', 47, 4, '2026-09-20T08:00:00Z'],
      ['planned-trip-route-track', 47, 11, '2026-09-23T08:05:00Z'],
    ]))
  })

  it('без файлов и при выключенном запросе ничего не качает', () => {
    const { Wrapper } = createQueryWrapper()

    const empty = renderHook(() => usePlannedTripOriginalTracks(47, []), { wrapper: Wrapper })
    renderHook(() => usePlannedTripOriginalTracks(47, [loopsKml], { enabled: false }), { wrapper: Wrapper })

    expect(empty.result.current).toEqual([])
    expect(api.downloadPlannedTripRouteFileBlob).not.toHaveBeenCalled()
  })
})

describe('мутации файлов поездки', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('загрузка добавляет файл в конец списка, прежние остаются', async () => {
    api.uploadPlannedTripRouteFile.mockResolvedValue(daysGpx)
    const { Wrapper, queryClient } = createQueryWrapper()
    queryClient.setQueryData(['planned-trip-route-files', 47], [loopsKml])

    const { result } = renderHook(() => useUploadPlannedTripRouteFile(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync({ tripId: 47, file: { uri: 'file:///day.gpx', name: 'day.gpx' } })
    })

    expect(
      (queryClient.getQueryData(['planned-trip-route-files', 47]) as PlannedTripRouteFile[]).map((file) => file.id),
    ).toEqual([4, 11])
  })

  it('удаление убирает из списка ровно свой файл', async () => {
    api.deletePlannedTripRouteFile.mockResolvedValue(undefined)
    const { Wrapper, queryClient } = createQueryWrapper()
    queryClient.setQueryData(['planned-trip-route-files', 47], [loopsKml, daysGpx])

    const { result } = renderHook(() => useDeletePlannedTripRouteFile(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync({ tripId: 47, routeId: 4 })
    })

    expect(api.deletePlannedTripRouteFile).toHaveBeenCalledWith(47, 4)
    expect(
      (queryClient.getQueryData(['planned-trip-route-files', 47]) as PlannedTripRouteFile[]).map((file) => file.id),
    ).toEqual([11])
  })
})
