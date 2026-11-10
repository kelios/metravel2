import { act, renderHook } from '@testing-library/react-native'

import {
  GALLERY_REORDER_DEBOUNCE_MS,
  useGalleryOrderPersistence,
} from '@/components/travel/gallery/useGalleryOrderPersistence'

jest.mock('@/api/misc', () => ({
  reorderGallery: jest.fn(),
}))
jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(async () => undefined),
}))

const { reorderGallery } = jest.requireMock('@/api/misc') as { reorderGallery: jest.Mock }
const { showToast } = jest.requireMock('@/utils/toast') as { showToast: jest.Mock }

type Item = { id: string }

describe('useGalleryOrderPersistence (#3215)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    reorderGallery.mockReset()
    showToast.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not roll back over a newer move when an earlier save fails', async () => {
    let items: Item[] = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const onRollback = jest.fn((order: Item[]) => {
      items = order
    })
    let rejectFirst: (error: Error) => void = () => undefined
    reorderGallery
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject }))
      .mockResolvedValueOnce(undefined)

    const { result } = await renderHook(() =>
      useGalleryOrderPersistence<Item>({
        collection: 'gallery',
        travelId: '42',
        getItems: () => items,
        getBackendId: (item) => item.id,
        onRollback,
      }),
    )

    const original = items
    items = [{ id: '2' }, { id: '1' }, { id: '3' }]
    await act(async () => { result.current.scheduleOrderSave(original) })
    await act(async () => { jest.advanceTimersByTime(GALLERY_REORDER_DEBOUNCE_MS) })
    expect(reorderGallery).toHaveBeenCalledTimes(1)

    // The author moves again while the first request is still in flight.
    const beforeSecondMove = items
    items = [{ id: '2' }, { id: '3' }, { id: '1' }]
    await act(async () => { result.current.scheduleOrderSave(beforeSecondMove) })

    await act(async () => {
      rejectFirst(new Error('offline'))
      await Promise.resolve()
    })
    expect(onRollback).not.toHaveBeenCalled()
    expect(items.map((item) => item.id)).toEqual(['2', '3', '1'])

    await act(async () => {
      jest.advanceTimersByTime(GALLERY_REORDER_DEBOUNCE_MS)
      await Promise.resolve()
    })
    expect(reorderGallery).toHaveBeenLastCalledWith(42, ['2', '3', '1'], expect.anything())
    expect(onRollback).not.toHaveBeenCalled()
  })

  it('restores the order the server still has when the only save fails', async () => {
    let items: Item[] = [{ id: '1' }, { id: '2' }]
    const onRollback = jest.fn()
    reorderGallery.mockRejectedValueOnce(new Error('offline'))

    const { result } = await renderHook(() =>
      useGalleryOrderPersistence<Item>({
        collection: 'gallery',
        travelId: 42,
        getItems: () => items,
        getBackendId: (item) => item.id,
        onRollback,
      }),
    )

    const original = items
    items = [{ id: '2' }, { id: '1' }]
    await act(async () => { result.current.scheduleOrderSave(original) })
    await act(async () => {
      jest.advanceTimersByTime(GALLERY_REORDER_DEBOUNCE_MS)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onRollback).toHaveBeenCalledWith(original)
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
  })
})
