import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'
import type { TravelRouteFile } from '@/types/travelRoutes'

const colors = { info: 'blue', success: 'green' }
jest.mock('@/hooks/useTheme', () => ({ useThemedColors: () => colors }))
jest.mock('@/utils/isWebAutomation', () => ({ isWebAutomation: false }))
jest.mock('@/hooks/useTravelRouteFiles', () => ({ useTravelRouteFiles: jest.fn() }))
jest.mock('@/api/travelRoutes', () => ({ downloadTravelRouteFileBlob: jest.fn() }))

const listFiles = jest.requireMock('@/hooks/useTravelRouteFiles').useTravelRouteFiles as jest.Mock
const download = jest.requireMock('@/api/travelRoutes').downloadTravelRouteFileBlob as jest.Mock
const file = { id: 7, ext: 'gpx', original_name: 'route.gpx' } as TravelRouteFile
const files = [file]
// Real parser/preview builder: do not mock the value-construction path.
const text = '<gpx><trk><trkseg><trkpt lat="50" lon="19"><ele>100</ele></trkpt><trkpt lat="50.1" lon="19.1"><ele>200</ele></trkpt></trkseg></trk></gpx>'
const defaults = { travelId: 544, canRenderHeavy: true, shouldRender: true, shouldForceRenderMap: false }
const platform = Platform.OS

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  listFiles.mockReturnValue({ data: files, isLoading: false, isFetching: false })
})
afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: platform }))

it('keeps a cached list unresolved before viewport parsing and until its real GPX is ready', async () => {
  let resolve!: (value: { text: string }) => void
  download.mockReturnValue(new Promise(done => { resolve = done }))
  const frames: { ready: boolean; loading: boolean }[] = []
  const { result, rerender } = await renderHook((props: typeof defaults) => {
    const value = useRouteFilePreviews(props)
    frames.push({ ready: value.isRoutePreviewReady, loading: value.isRoutePreviewLoading })
    return value
  }, { initialProps: { ...defaults, shouldRender: false } })
  expect(result.current.isRoutePreviewReady).toBe(false)
  expect(download).not.toHaveBeenCalled()
  await rerender(defaults)
  expect(frames[0]).toEqual({ ready: false, loading: false })
  expect(result.current.isRoutePreviewReady).toBe(false)
  await act(async () => resolve({ text }))
  await waitFor(() => expect(result.current.isRoutePreviewReady).toBe(true))
  expect(result.current.routePreviewItems).toHaveLength(1)
  expect(result.current.routePreviewItems[0].preview.linePoints).toHaveLength(2)
  expect(download).toHaveBeenCalledTimes(1)
})

it('does not let an earlier article completion settle the current source', async () => {
  const resolves: ((value: { text: string }) => void)[] = []
  download.mockImplementation(() => new Promise(done => resolves.push(done)))
  const { result, rerender } = await renderHook((props: typeof defaults) => useRouteFilePreviews(props), { initialProps: defaults })
  await rerender({ ...defaults, travelId: 470 })
  await act(async () => resolves[0]({ text }))
  expect(result.current.isRoutePreviewReady).toBe(false)
  await act(async () => resolves[1]({ text }))
  expect(result.current.isRoutePreviewReady).toBe(true)
  expect(download).toHaveBeenCalledTimes(2)
})

it('invalidates readiness synchronously for a replaced file snapshot', async () => {
  download.mockResolvedValue({ text })
  const { result, rerender } = await renderHook(() => useRouteFilePreviews(defaults))
  await waitFor(() => expect(result.current.isRoutePreviewReady).toBe(true))
  download.mockReturnValue(new Promise(() => {}))
  listFiles.mockReturnValue({ data: [{ ...file, id: 8 }], isLoading: false, isFetching: false })
  await rerender({})
  expect(result.current.isRoutePreviewReady).toBe(false)
})

it.each([
  { data: undefined, isLoading: false, isFetching: false, ready: false },
  { data: [], isLoading: true, isFetching: true, ready: false },
  { data: [], isLoading: false, isFetching: false, ready: true },
  { data: undefined, error: new Error('503'), isLoading: false, isFetching: false, ready: true },
])('distinguishes unresolved, empty and failed file lists (%j)', async ({ ready, ...query }) => {
  listFiles.mockReturnValue(query)
  const { result } = await renderHook(() => useRouteFilePreviews(defaults))
  expect(result.current.isRoutePreviewReady).toBe(ready)
  expect(download).not.toHaveBeenCalled()
})

it('settles an undrawable/failed file without retaining a permanent reserve', async () => {
  download.mockRejectedValue(new Error('503'))
  const { result } = await renderHook(() => useRouteFilePreviews(defaults))
  await waitFor(() => expect(result.current.isRoutePreviewReady).toBe(true))
  expect(result.current.routePreviewItems).toEqual([])
})
