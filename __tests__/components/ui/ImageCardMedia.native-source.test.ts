import { buildNativeSharpImageSource } from '@/components/ui/ImageCardMedia'

describe('ImageCardMedia native sharp source', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
  })

  afterAll(() => {
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl
    }
  })

  it('adds bounded physical dimensions for an unsized MeTravel image', () => {
    const source = buildNativeSharpImageSource({
      uri: 'https://metravel.by/quest-cover/quests/68/main/cover.png',
      width: 132,
      height: 88,
      quality: 60,
      fit: 'cover',
      pixelRatio: 3,
    })

    expect(source?.uri).toContain('w=480')
    expect(source?.uri).toContain('h=320')
    expect(source?.uri).toContain('q=60')
    expect(source?.uri).toContain('fit=cover')
  })

  it('preserves a URL that already owns its optimization parameters', () => {
    expect(buildNativeSharpImageSource({
      uri: 'https://metravel.by/address-image/1/photo.jpg?w=480&q=60',
      width: 132,
      height: 88,
      quality: 60,
      fit: 'cover',
      pixelRatio: 3,
    })).toBeNull()
  })

  it('caps the requested dimensions at the backend limit', () => {
    const source = buildNativeSharpImageSource({
      uri: 'https://metravel.by/travel-image/1/photo.jpg',
      width: 800,
      height: 600,
      quality: 70,
      fit: 'contain',
      pixelRatio: 3,
    })

    expect(source?.uri).toContain('w=1024')
    expect(source?.uri).toContain('h=1024')
  })
})
