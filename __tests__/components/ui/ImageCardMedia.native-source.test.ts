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
    expect(source?.uri).toContain('q=60')
    expect(source?.uri).toContain('fit=cover')
    // #1113: `h` больше не отправляется — прокси ресайзит только по ширине, а
    // высота в URL делала ссылку зависимой от геометрии контейнера и плодила
    // лишние варианты того же файла.
    expect(source?.uri).not.toMatch(/[?&]h=/)
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

  // #1113: потолок был 1024 — ширина, которой у прокси нет; на такой запрос он молча
  // отдаёт оригинал, то есть «сайзинг» крупных native-карточек не работал вообще.
  // Замер прода 2026-07-28 (исходник 1024×576, 132 344 B): w=1024 → 132 344 B,
  // w=800 → 53 104 B. Потолок = верхняя ступень whitelist, которая не даёт апскейла.
  it('caps the requested width at a width the proxy actually resizes', () => {
    const source = buildNativeSharpImageSource({
      uri: 'https://metravel.by/travel-image/1/photo.jpg',
      width: 800,
      height: 600,
      quality: 70,
      fit: 'contain',
      pixelRatio: 3,
    })

    expect(source?.uri).toContain('w=800')
    expect(source?.uri).not.toMatch(/w=(1024|2048)\b/)
    expect(source?.uri).not.toMatch(/[?&]h=/)
  })
})
