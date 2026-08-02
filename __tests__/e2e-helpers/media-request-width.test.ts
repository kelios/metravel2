import { isMediaRequestWithoutWidth } from '../../e2e/helpers/mediaRequestWidth'

/**
 * #1161: e2e-бюджет падает, если хоть один медиа-запрос ушёл без `w`. Сам детектор
 * тоже нужно проверить — иначе гейт может «зеленеть» просто потому, что ничего не
 * распознаёт как медиа. Набор путей повторяет `MEDIA_FILE_PATH` +
 * `PROXY_MEDIA_PREFIX` из `utils/imageProxy.ts`.
 */
const MEDIA_PATHS = [
  '/gallery/540/gallery/x.webp',
  '/travel-image/682/conversions/abc.webp',
  '/travel-description-image/540/description/abc.JPG',
  '/address-image/1/photo.jpg',
  '/quest-cover/quests/68/main/cover.png',
  '/avatar/profile/82/avatar/a.webp',
]

describe('e2e perf budget — детектор медиа-запроса без ширины (#1161)', () => {
  it.each(MEDIA_PATHS)('ловит %s без w', (path) => {
    expect(isMediaRequestWithoutWidth(`https://metravel.by${path}`)).toBe(true)
  })

  it.each(MEDIA_PATHS)('пропускает %s с валидной w', (path) => {
    expect(isMediaRequestWithoutWidth(`https://metravel.by${path}?w=320&q=70`)).toBe(false)
  })

  // Параметры без ширины — та же ошибка: прокси ресайзит только по `w`, поэтому
  // `?q=60&fit=contain` отдаёт мастер ровно как голый URL.
  it('ловит запрос, где есть q/fit, но нет w', () => {
    expect(isMediaRequestWithoutWidth('https://metravel.by/gallery/1/g/x.webp?q=60&fit=contain')).toBe(true)
  })

  it('ловит нечисловую и нулевую ширину', () => {
    expect(isMediaRequestWithoutWidth('https://metravel.by/gallery/1/g/x.webp?w=auto')).toBe(true)
    expect(isMediaRequestWithoutWidth('https://metravel.by/gallery/1/g/x.webp?w=0')).toBe(true)
  })

  it('не трогает немедийные пути и сторонние URL', () => {
    expect(isMediaRequestWithoutWidth('https://metravel.by/api/travels/')).toBe(false)
    expect(isMediaRequestWithoutWidth('https://metravel.by/_expo/static/js/web/entry.js')).toBe(false)
    expect(isMediaRequestWithoutWidth('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(false)
    expect(isMediaRequestWithoutWidth('data:image/png;base64,iVBOR')).toBe(false)
    expect(isMediaRequestWithoutWidth('not a url')).toBe(false)
  })

  // Детектор держит собственную копию списка медиа-путей (он обязан быть без
  // зависимостей, чтобы работать и в Playwright, и в jest). Копия — это ровно тот
  // способ разойтись, которым уже разошлась лестница ширин, поэтому здесь она
  // сверяется с поведением настоящего `optimizeImageUrl`.
  describe('набор путей не разошёлся с utils/imageProxy', () => {
    const previousApiUrl = process.env.EXPO_PUBLIC_API_URL

    beforeEach(() => {
      process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    })

    afterAll(() => {
      process.env.EXPO_PUBLIC_API_URL = previousApiUrl
    })

    it.each(MEDIA_PATHS)('%s: с шириной проходит, без ширины ловится', (path) => {
      const { optimizeImageUrl } = require('@/utils/imageProxy')
      const raw = `https://metravel.by${path}`

      const sized = optimizeImageUrl(raw, { width: 320 })
      expect({ path, sized: isMediaRequestWithoutWidth(sized) }).toEqual({ path, sized: false })

      // #1195: ключ класса `**/conversions/**` уводится на `/media-resize/legacy/`,
      // а тот widthless URL запрещает и подставляет канонический w=800. Мастер
      // такой запрос уже не тянет, поэтому ловить тут нечего — детектор остаётся
      // гейтом для остальных family-путей, где голый URL по-прежнему = мастер.
      const expectUnsizedCaught = !path.includes('/conversions/')
      const unsized = optimizeImageUrl(raw, {})
      expect({ path, unsized: isMediaRequestWithoutWidth(unsized) }).toEqual({
        path,
        unsized: expectUnsizedCaught,
      })
    })
  })
})
