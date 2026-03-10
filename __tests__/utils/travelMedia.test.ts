import { createSafeImageUrl, safeGetYoutubeId } from '@/utils/travelMedia'

describe('travelMedia', () => {
  it('extracts a valid youtube id from supported urls', () => {
    expect(safeGetYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(safeGetYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('creates a safe versioned image url', () => {
    const result = createSafeImageUrl('http://cdn.example.com/image.jpg', '2025-01-01', 123)

    expect(result).toContain('https://cdn.example.com/image.jpg')
    expect(result).toContain('v=')
  })
})
