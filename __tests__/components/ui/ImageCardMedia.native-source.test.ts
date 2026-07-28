import { buildNativeBlurSource, buildNativeSharpImageSource } from '@/components/ui/ImageCardMedia'

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

// Regression guard for #1111: the blur backdrop must never introduce a second
// network address. A separate downscaled URL used to be requested per card, and
// on paths where the proxy ignored small widths it cost as much as the photo.
describe('ImageCardMedia native blur backdrop reuses one fetch', () => {
  const sharpUri = 'https://metravel.by/travel-image/1436/conversions/photo-thumb_200.jpg?w=480&q=60'

  it('reuses the sharp URI verbatim and only overrides decode size', () => {
    const blur = buildNativeBlurSource({
      blurBackground: true,
      source: { uri: sharpUri },
      blurDecodeSize: 360,
    })

    expect(blur?.uri).toBe(sharpUri)
    expect(blur?.width).toBe(360)
    expect(blur?.height).toBe(360)
  })

  it('never rewrites the URL to a smaller proxy variant', () => {
    const blur = buildNativeBlurSource({
      blurBackground: true,
      source: { uri: 'https://metravel.by/quest-cover/quests/68/main/cover.png' },
    })

    expect(blur?.uri).toBe('https://metravel.by/quest-cover/quests/68/main/cover.png')
    expect(blur?.uri).not.toMatch(/w=96|q=30/)
  })

  it('honours an explicit blurSrc when the caller supplies a real alternative', () => {
    const lqip = 'https://metravel.by/travel-image/1436/conversions/photo-lqip.jpg'
    const blur = buildNativeBlurSource({
      blurBackground: true,
      source: { uri: sharpUri },
      blurSrc: lqip,
      blurDecodeSize: 128,
    })

    expect(blur?.uri).toBe(lqip)
  })

  it('produces nothing when the backdrop is disabled or the source is unusable', () => {
    expect(buildNativeBlurSource({ blurBackground: false, source: { uri: sharpUri } })).toBeUndefined()
    expect(buildNativeBlurSource({ blurBackground: true, source: null })).toBeUndefined()
    expect(buildNativeBlurSource({ blurBackground: true, source: { uri: '   ' } })).toBeUndefined()
  })
})
