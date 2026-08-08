/**
 * Ядро миграции картинок в телах статей (`scripts/migrate-description-images.js`).
 *
 * Покрываем ветку base64 (#1320): именно она пишет в живые опубликованные статьи,
 * и ошибка сбора здесь означает либо пропущенный 40-мегабайтный кадр, либо замену,
 * задевшую чужой `src`.
 */

const {
  collectDataUriRefs,
  collectLegacyUploadRefs,
  countImages,
  decodeDataUri,
  plainText,
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
