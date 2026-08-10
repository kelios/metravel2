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
    // `quest-cover` — durable-семейство: производная уже нарезана с качеством
    // своего профиля и под свой fit, поэтому `q`/`fit` не отправляются (гейт
    // `servedFromDurableFamily` в `utils/imageProxy.ts`). Проба прода 2026-08-10:
    // `?w=800` и `?w=800&q=60&fit=cover` — один и тот же md5 `c6aa4466…`, 7 798 B.
    // Здесь такие же ожидания, что и в `__tests__/components/QuestCard.test.tsx`.
    expect(source?.uri).not.toMatch(/[?&]q=/)
    expect(source?.uri).not.toMatch(/[?&]fit=/)
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

  // #1161: правило «без ширины медиа-запрос не строим» обязано действовать и на
  // native — именно здесь оно нарушалось в #1103, где sharp-слой уходил в Glide
  // исходным URL и карточка 132dp платила полный вес оригинала.
  describe('без известной ширины запрос не строится (#1161)', () => {
    const base = {
      uri: 'https://metravel.by/quest-cover/quests/68/main/cover.png',
      quality: 60,
      fit: 'cover' as const,
      pixelRatio: 3,
    }

    it('возвращает null, когда ни width, ни height ещё не измерены', () => {
      expect(buildNativeSharpImageSource({ ...base })).toBeNull()
    })

    it('возвращает null на нулевой и отрицательной ширине', () => {
      expect(buildNativeSharpImageSource({ ...base, width: 0 })).toBeNull()
      expect(buildNativeSharpImageSource({ ...base, width: -10 })).toBeNull()
    })

    // Любой построенный native-URL обязан нести `w`: без него прокси отдаёт мастер.
    it('всякий раз, когда URL всё-таки построен, в нём есть w', () => {
      for (const width of [1, 24, 132, 320, 4000]) {
        const source = buildNativeSharpImageSource({ ...base, width })
        expect({ width, hasW: /[?&]w=\d+/.test(source?.uri ?? '') }).toEqual({ width, hasW: true })
      }
    })
  })
})
