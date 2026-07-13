// Префетч фото квеста: фильтрация не-http, дедуп, устойчивость к частичным фейлам.
import { Image } from 'expo-image'
import { collectQuestImageUrls, prefetchQuestImages } from '@/utils/questImagePrefetch'

jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn() } }))

const mockedPrefetch = Image.prefetch as jest.MockedFunction<typeof Image.prefetch>

describe('questImagePrefetch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('collectQuestImageUrls keeps unique http(s) urls only', () => {
    const urls = collectQuestImageUrls([
      'https://a.jpg',
      'https://a.jpg',
      'http://b.png',
      'data:image/png;base64,xxx',
      undefined,
      null,
      '',
    ])
    expect(urls).toEqual(['https://a.jpg', 'http://b.png'])
  })

  it('returns zero totals when there is nothing to prefetch', async () => {
    const res = await prefetchQuestImages([undefined, null, 'not-a-url'])
    expect(res).toEqual({ total: 0, ok: 0 })
    expect(mockedPrefetch).not.toHaveBeenCalled()
  })

  it('counts partial failures without throwing', async () => {
    mockedPrefetch
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(false)

    const res = await prefetchQuestImages(['https://1.jpg', 'https://2.jpg', 'https://3.jpg'])
    expect(res).toEqual({ total: 3, ok: 1 })
  })
})
