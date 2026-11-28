import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useAdventCardShare } from '@/components/advent/useAdventCardShare'

const mockRender = jest.fn((..._args: unknown[]) => new Blob(['png']))
const mockShare = jest.fn(async (..._args: unknown[]) => 'shared')
const mockDownload = jest.fn((..._args: unknown[]) => true)
jest.mock('@/utils/advent/adventShareKit', () => ({
  renderAdventCardPng: (...args: unknown[]) => mockRender(...args),
  shareAdventCard: (...args: unknown[]) => mockShare(...args),
  downloadAdventCard: (...args: unknown[]) => mockDownload(...args),
}))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

class TestImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  constructor() { images.push(this) }
}
const images: TestImage[] = []
const params = {
  kind: 'title' as const, year: 2026, filename: 'title.png',
  shareTitle: 'Легенда дорог', shareText: 'Моё звание',
  buildSpec: () => ({ eyebrow: 'Адвент', title: 'Легенда дорог', stats: [] }),
}
const finish = async (image: TestImage, succeeds = true) => {
  await act(async () => { if (succeeds) image.onload?.(); else image.onerror?.() })
}

describe('title illustration preparation', () => {
  const OriginalImage = global.Image
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
    global.Image = TestImage as unknown as typeof Image
    images.length = 0
    jest.clearAllMocks()
  })
  afterEach(() => { global.Image = OriginalImage; jest.restoreAllMocks() })

  it('prepares the earned illustration before sharing and uses it in the downloaded PNG', async () => {
    const { result } = await renderHook(() => useAdventCardShare({ ...params, titleArtwork: 'rail' }))
    expect(result.current.status).toBe('busy')
    expect(images[0].src).toBe('/assets/images/advent-titles/rail.webp')
    await finish(images[0])
    await waitFor(() => expect(result.current.status).toBe('idle'))
    await act(async () => { await result.current.share() })
    expect(mockRender).toHaveBeenCalledWith(params.buildSpec(), images[0])
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({ image: expect.any(Blob), filename: 'title.png' }))
    await act(async () => { await result.current.download() })
    expect(mockDownload).toHaveBeenCalledWith(expect.any(Blob), 'title.png')
    expect(images).toHaveLength(1)
  })

  it('can still share a link after an image failure and retries the image for download', async () => {
    const { result } = await renderHook(() => useAdventCardShare({ ...params, titleArtwork: 'rail' }))
    await finish(images[0], false)
    await waitFor(() => expect(result.current.status).toBe('idle'))
    await act(async () => { await result.current.share() })
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({ image: null }))
    expect(mockRender).not.toHaveBeenCalled()
    let download: Promise<void>
    await act(async () => { download = result.current.download() })
    expect(images).toHaveLength(2)
    await act(async () => { images[1].onload?.(); await download! })
    expect(mockRender).toHaveBeenCalledWith(params.buildSpec(), images[1])
    expect(result.current.status).toBe('idle')
    await act(async () => { await result.current.download() })
    expect(images).toHaveLength(2)
  })

  it('ignores a previous level loading late and exports the current level', async () => {
    const { result, rerender } = await renderHook(({ name }) => useAdventCardShare({ ...params, titleArtwork: name }), { initialProps: { name: 'departure' } })
    await rerender({ name: 'rail' })
    await finish(images[0])
    expect(result.current.status).toBe('busy')
    await finish(images[1])
    await waitFor(() => expect(result.current.status).toBe('idle'))
    await act(async () => { await result.current.download() })
    expect(mockRender).toHaveBeenCalledWith(params.buildSpec(), images[1])
  })

  it('keeps native sharing as a link without starting browser image loading', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    const { result } = await renderHook(() => useAdventCardShare({ ...params, titleArtwork: 'rail' }))
    await act(async () => { await result.current.share() })
    expect(images).toHaveLength(0)
    expect(mockRender).not.toHaveBeenCalled()
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({ image: null }))
  })
})
