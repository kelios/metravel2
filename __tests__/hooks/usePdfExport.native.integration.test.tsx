// Actual hook + runtime + native PrintSession. Only service/OS/API boundaries
// are mocked. RN's real abort-controller polyfill deliberately has no reason.
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { buildInitialSettings } from '@/components/export/BookSettingsModal.helpers'
import { usePdfExport } from '@/hooks/usePdfExport'
import { ExportStage } from '@/types/pdf-export'
import type { Travel } from '@/types/types'
import type { PrintSession } from '@/utils/printHtml.types'
import { showToast } from '@/utils/toast'

const mockGenerate = jest.fn()
const mockRenderFile = jest.fn()
const mockPrint = jest.fn()
let mockLastSession: PrintSession | undefined

jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }))
jest.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mockRenderFile(...args),
  printAsync: (...args: unknown[]) => mockPrint(...args),
}))
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn(async () => undefined) }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(async () => undefined) }))
jest.mock('@/api/bookExportApi', () => ({
  requestServerBookExport: jest.fn(async () => null),
  downloadBookExportArtifact: jest.fn(),
}))
jest.mock('@/api/travelDetailsQueries', () => ({ fetchTravel: jest.fn(), fetchTravelBySlug: jest.fn() }))
jest.mock('@/services/book/BookHtmlExportService', () => ({
  BookHtmlExportService: jest.fn().mockImplementation(() => ({
    generateTravelsHtml: (...args: unknown[]) => mockGenerate(...args),
  })),
}))
jest.mock('@/utils/printHtml', () => {
  const native = jest.requireActual('@/utils/printHtml.native') as typeof import('@/utils/printHtml.native')
  return {
    ...native,
    beginPrint: () => {
      mockLastSession = native.beginPrint()
      return mockLastSession
    },
  }
})

const settings: BookSettings = buildInitialSettings({ includeGallery: false, includeMap: false })
const travels = [{
  id: 1, name: 'Native contract', description: 'Description', recommendation: '',
  plus: '', minus: '', gallery: [], travelAddress: [], travel_image_url: '',
}] as unknown as Travel[]
const originalController = global.AbortController
const originalOS = Platform.OS
const rnAbort = jest.requireActual('abort-controller') as typeof import('abort-controller')
const mockToast = showToast as jest.Mock

beforeEach(() => {
  global.AbortController = rnAbort.AbortController as unknown as typeof AbortController
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  mockLastSession = undefined
  mockGenerate.mockReset().mockResolvedValue('<p>Native book</p>')
  mockRenderFile.mockReset().mockResolvedValue({ uri: 'file:///cache/book.pdf', numberOfPages: 1 })
  mockPrint.mockReset().mockResolvedValue(undefined)
  mockToast.mockClear()
})

afterEach(() => {
  global.AbortController = originalController
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  jest.useRealTimers()
})

describe('native preparation outcome reaches usePdfExport with RN AbortController', () => {
  it.each(['generator', 'renderer', 'printer'] as const)('%s error survives default-abort session cleanup', async (boundary) => {
    const failure = new Error(`${boundary} failed`)
    if (boundary === 'generator') mockGenerate.mockRejectedValueOnce(failure)
    else if (boundary === 'renderer') mockRenderFile.mockRejectedValueOnce(failure)
    else mockPrint.mockRejectedValueOnce(failure)
    const { result } = renderHook(() => usePdfExport(travels))
    await act(async () => { await result.current.openPrintBook(settings) })

    expect(mockLastSession?.preparationSignal?.aborted).toBe(true)
    expect(mockLastSession?.preparationSignal).not.toHaveProperty('reason')
    expect(mockLastSession?.getPreparationError?.()).toBeUndefined()
    expect(result.current.error).toBe(failure)
    expect(result.current.currentStage).toBe(ExportStage.ERROR)
    expect(result.current.isGenerating).toBe(false)
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', text2: failure.message }))
  })

  it('a hung generation times out through the explicit session error, settles caller and never prints late', async () => {
    jest.useFakeTimers()
    try {
      let finish: (html: string) => void = () => {}
      mockGenerate.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve }))
      const { result } = renderHook(() => usePdfExport(travels))
      let pending: Promise<void> = Promise.resolve()
      act(() => { pending = result.current.openPrintBook(settings) })
      await act(async () => { await jest.advanceTimersByTimeAsync(0) })
      expect(mockGenerate).toHaveBeenCalledTimes(1)
      expect(mockLastSession?.preparationSignal).not.toHaveProperty('reason')
  
      await act(async () => {
        await jest.advanceTimersByTimeAsync(120_000)
        await pending
      })
      expect(mockLastSession?.getPreparationError?.()?.message).toContain('120')
      expect(result.current.error).toBe(mockLastSession?.getPreparationError?.())
      expect(result.current.currentStage).toBe(ExportStage.ERROR)
      expect(result.current.isGenerating).toBe(false)
      expect(mockToast).toHaveBeenCalledTimes(1)
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', text1: expect.stringContaining('120') }))
  
      await act(async () => { finish('<p>late</p>'); await jest.advanceTimersByTimeAsync(0) })
      expect(mockRenderFile).not.toHaveBeenCalled()
      expect(mockPrint).not.toHaveBeenCalled()
    } finally {
      // RNTL auto-cleanup runs before this file's afterEach and flushes a
      // jsdom setImmediate fallback; restore timers before it starts.
      jest.useRealTimers()
    }
  })
})
