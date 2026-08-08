/**
 * Ядро миграции картинок в телах статей (`scripts/migrate-description-images.js`).
 *
 * Покрываем ветку base64 (#1320): именно она пишет в живые опубликованные статьи,
 * и ошибка сбора здесь означает либо пропущенный 40-мегабайтный кадр, либо замену,
 * задевшую чужой `src`.
 */

const {
  bytesPerPixel,
  buildManifestGeometry,
  collectCanonicalRefs,
  collectDataUriRefs,
  collectLegacyUploadRefs,
  countImages,
  decodeDataUri,
  isOversizedFrame,
  plainText,
  shrinkWidthFor,
} = require('../../scripts/migrate-description-images.js')

// Однопиксельный PNG — единственный формат, который нужен для проверки сигнатуры.
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_DATA_URI = `data:image/png;base64,${PNG_1PX_BASE64}`

describe('collectDataUriRefs', () => {
  it('находит base64-кадр и возвращает строку для замены целиком', () => {
    const refs = collectDataUriRefs(`<p>текст</p><img src="${PNG_DATA_URI}" alt="фото">`)

    expect(refs).toHaveLength(1)
    expect(refs[0].raw).toBe(PNG_DATA_URI)
    expect(refs[0].dataUri).toBe(true)
    expect(refs[0].key).toContain('image/png')
  })

  it('не трогает обычные адреса', () => {
    const html =
      '<img src="https://metravel.by/travel-description-image/512/description/a.jpg">' +
      '<img src="https://images.weserv.nl/?url=metravel.by/x.jpg">'

    expect(collectDataUriRefs(html)).toEqual([])
  })

  it('дедуплицирует один и тот же кадр, вставленный дважды', () => {
    const html = `<img src="${PNG_DATA_URI}"><p>между</p><img src="${PNG_DATA_URI}">`

    expect(collectDataUriRefs(html)).toHaveLength(1)
  })

  it('нумерует разные кадры по порядку', () => {
    const other = `data:image/jpeg;base64,${PNG_1PX_BASE64}`
    const refs = collectDataUriRefs(`<img src="${PNG_DATA_URI}"><img src="${other}">`)

    expect(refs.map((ref: { key: string }) => ref.key.split(' ')[0])).toEqual([
      'data-uri#1',
      'data-uri#2',
    ])
  })

  it('пустое тело не роняет сбор', () => {
    expect(collectDataUriRefs('')).toEqual([])
    expect(collectDataUriRefs(null)).toEqual([])
  })
})

describe('decodeDataUri', () => {
  it('декодирует кадр и берёт формат по сигнатуре, а не по объявленному MIME', () => {
    // Автор вставки объявил jpeg, внутри PNG — верить надо байтам.
    const file = decodeDataUri(`data:image/jpeg;base64,${PNG_1PX_BASE64}`)

    expect(file.contentType).toBe('image/png')
    expect(file.filename).toBe('description-image.png')
    expect(file.buffer.length).toBeGreaterThan(0)
  })

  it('отвергает не-base64 форму', () => {
    expect(() => decodeDataUri('data:image/svg+xml,<svg/>')).toThrow(/base64/)
  })

  it('отвергает нераспознанный кадр', () => {
    const notAnImage = Buffer.from('это не картинка').toString('base64')

    expect(() => decodeDataUri(`data:image/png;base64,${notAnImage}`)).toThrow(/формат/)
  })

  it('отвергает пустой кадр', () => {
    expect(() => decodeDataUri('data:image/png;base64,')).toThrow(/base64|пустой/)
  })
})

describe('инварианты содержания при замене base64 на адрес', () => {
  const url = 'https://metravel.by/travel-description-image/512/description/a.png'
  const before = `<h2>Заголовок</h2><img src="${PNG_DATA_URI}" alt="вид"><p>Абзац.</p>`
  const after = before.split(PNG_DATA_URI).join(url)

  it('число картинок и текст не меняются, base64 в теле не остаётся', () => {
    expect(countImages(after)).toBe(countImages(before))
    expect(plainText(after)).toBe(plainText(before))
    expect(collectDataUriRefs(after)).toEqual([])
    expect(collectLegacyUploadRefs(after)).toEqual([])
  })
})

describe('shrinkWidthFor', () => {
  it('берёт ступень СТРОГО ниже ширины кадра — только на ней прокси пережимает', () => {
    // 768 → 720: замер прода даёт 317 486 B против 112 602 B.
    expect(shrinkWidthFor(768)).toBe(720)
    expect(shrinkWidthFor(600)).toBe(480)
    expect(shrinkWidthFor(1440)).toBe(1280)
  })

  it('на самой ступени не возвращает её же: w=800 у кадра 800 отдал бы мастер', () => {
    expect(shrinkWidthFor(800)).toBe(720)
    expect(shrinkWidthFor(320)).toBe(160)
  })

  it('нет ступени ниже — null', () => {
    expect(shrinkWidthFor(32)).toBeNull()
    expect(shrinkWidthFor(0)).toBeNull()
    expect(shrinkWidthFor(undefined)).toBeNull()
  })
})

describe('isOversizedFrame', () => {
  it('раздутый кадр прода распознаётся: 768×1024 при 317 486 B', () => {
    expect(isOversizedFrame({ bytes: 317486, width: 768, height: 1024 })).toBe(true)
  })

  it('здоровый кадр не трогается: 800×1067 при 94 078 B', () => {
    expect(isOversizedFrame({ bytes: 94078, width: 800, height: 1067 })).toBe(false)
  })

  it('порог считается по плотности, а не по абсолютному весу', () => {
    expect(bytesPerPixel(317486, 768, 1024)).toBeCloseTo(0.404, 3)
    expect(bytesPerPixel(94078, 800, 1067)).toBeCloseTo(0.11, 2)
    expect(bytesPerPixel(1000, 0, 0)).toBeNull()
  })

  it('мелкий кадр пропускается: ступень ниже 320 уже видна на глаз', () => {
    expect(isOversizedFrame({ bytes: 200000, width: 320, height: 240 })).toBe(false)
  })
})

describe('collectCanonicalRefs', () => {
  const canonical = 'https://metravel.by/travel-description-image/247b89ab.webp'

  it('берёт только канонический класс, мимо legacy и base64', () => {
    const html =
      `<img src="${canonical}">` +
      `<img src="${PNG_DATA_URI}">` +
      '<img src="https://metravel.by/media-resize/uploads/1/a.jpg">' +
      '<img src="https://example.com/foreign.jpg">'
    expect(collectCanonicalRefs(html).map((r: { raw: string }) => r.raw)).toEqual([canonical])
  })

  it('дедуплицирует один и тот же адрес и отдаёт pathname для сверки с манифестом', () => {
    const refs = collectCanonicalRefs(`<img src="${canonical}"><p>x</p><img src="${canonical}">`)
    expect(refs).toHaveLength(1)
    expect(refs[0].pathname).toBe('/travel-description-image/247b89ab.webp')
  })
})

describe('buildManifestGeometry', () => {
  it('индексирует размеры по pathname, игнорируя ступень в query', () => {
    const geometry = buildManifestGeometry({
      media: {
        article_body: {
          gallery: [
            { src: `${'https://metravel.by/travel-description-image/a.webp'}?w=1600`, width: 768, height: 1024 },
            { src: 'https://metravel.by/travel-description-image/b.webp', width: 0, height: 0 },
          ],
        },
      },
    })
    expect(geometry.get('/travel-description-image/a.webp')).toEqual({ width: 768, height: 1024 })
    expect(geometry.has('/travel-description-image/b.webp')).toBe(false)
  })

  it('нет манифеста — пустой индекс, а не падение', () => {
    expect(buildManifestGeometry({}).size).toBe(0)
    expect(buildManifestGeometry(null).size).toBe(0)
  })
})
