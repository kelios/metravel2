/**
 * Ядро миграции картинок в телах статей (`scripts/migrate-description-images.js`).
 *
 * Покрываем ветку base64 (#1320): именно она пишет в живые опубликованные статьи,
 * и ошибка сбора здесь означает либо пропущенный 40-мегабайтный кадр, либо замену,
 * задевшую чужой `src`.
 */

const {
  BODY_FIELDS,
  assertOnlyAddressesChanged,
  bytesPerPixel,
  buildManifestGeometry,
  collectBodyFieldRefs,
  collectCanonicalRefs,
  collectDataUriRefs,
  collectLegacyUploadRefs,
  collectPointImageRefs,
  countImages,
  decodeDataUri,
  describeRefs,
  isOversizedFrame,
  plainText,
  shrinkWidthFor,
} = require('../../scripts/migrate-description-images.js')
const { RICH_TEXT_FIELDS } = require('../../scripts/lib/articleBodyMedia.js')
const { buildUpsertPayload } = require('../../scripts/seo-edit.js')

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

describe('collectPointImageRefs', () => {
  const point = (id: number, file = 'a.webp') =>
    `<img src="https://metravel.by/address-image/${id}/conversions/${file}">`;

  it('берёт фото точки и в абсолютной, и в корне-относительной форме', () => {
    const refs = collectPointImageRefs(
      `${point(15601)}<img src="/address-image/437/conversions/b.JPG">`,
    );

    expect(refs.map((ref: any) => ref.key)).toEqual([
      'address-image/15601/conversions/a.webp',
      'address-image/437/conversions/b.JPG',
    ]);
    // Кадр лежит по собственному адресу — этим ветка и отличается от legacy-ключа.
    expect(refs[0].frameUrl).toBe('https://metravel.by/address-image/15601/conversions/a.webp');
  });

  it('разворачивает weserv-обёртку, но заменять будет исходную строку', () => {
    const raw =
      'https://images.weserv.nl/?url=metravel.by%2Faddress-image%2F15601%2Fconversions%2Fa.webp';
    const refs = collectPointImageRefs(`<img src="${raw}">`);

    expect(refs).toHaveLength(1);
    expect(refs[0].raw).toBe(raw);
    expect(refs[0].key).toBe('address-image/15601/conversions/a.webp');
  });

  it('не трогает соседние классы тела', () => {
    const html =
      '<img src="https://metravel.by/travel-description-image/1/description/c.webp">' +
      '<img src="https://metravel.by/gallery/901/gallery/d.jpg">' +
      `<img src="${PNG_DATA_URI}">`;

    expect(collectPointImageRefs(html)).toEqual([]);
  });

  it('дедуплицирует один и тот же адрес', () => {
    expect(collectPointImageRefs(`${point(15601)}${point(15601)}`)).toHaveLength(1);
  });
});

/**
 * Охват полей (#1855).
 *
 * Конвейер #1245 читал и писал одно `description`, поэтому семь legacy-кадров в
 * `recommendation` статей 116/171/220/290 конвейер не видел вовсе: `--dry-run`
 * показывал «legacy 0», а инвентарь по корпусу — «класса больше нет». Тесты
 * держат ровно это: поле, отличное от описания, доходит и до сбора, и до записи.
 */
describe('collectBodyFieldRefs', () => {
  const LEGACY = 'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1614096729IMG_6960.JPG'

  it('покрывает все четыре rich-text-поля тела', () => {
    expect(BODY_FIELDS).toEqual(['description', 'plus', 'minus', 'recommendation'])
    expect(collectBodyFieldRefs({}).map((entry: { field: string }) => entry.field)).toEqual(BODY_FIELDS)
  })

  // Охват миграции и охват 404-прогона (#1834) обязаны быть ОДНИМ списком: их
  // расхождение и есть механизм #1855 — аудит смотрел четыре поля, конвейер писал
  // одно, и оба отчитывались «чисто». Копия списка здесь этот гейт снимает.
  it('охват = общий список rich-text-полей, а не своя копия', () => {
    expect(BODY_FIELDS).toBe(RICH_TEXT_FIELDS)
  })

  // Читать поле мало — его надо ещё и записать. `buildUpsertPayload` принимает
  // переопределения по ИМЕНАМ полей, поэтому расширение общего списка без
  // расширения payload означало бы, что миграция переписывает тело, а PUT молча
  // отдаёт его обратно старым.
  it('каждое поле охвата переносится в payload upsert', () => {
    const detail = { id: 1, name: 'x', description: '<p>d</p>', plus: '<p>p</p>', minus: '<p>m</p>', recommendation: '<p>r</p>' }
    for (const field of BODY_FIELDS) {
      const payload = buildUpsertPayload(detail, { [field]: '<p>переписано</p>' })
      expect(payload[field]).toBe('<p>переписано</p>')
      for (const other of BODY_FIELDS) {
        if (other !== field) expect(payload[other]).toBe(detail[other])
      }
    }
  })

  it('находит legacy-кадр в recommendation при чистом description', () => {
    const detail = { description: '<p>чистое тело</p>', recommendation: `<p><img src="${LEGACY}"></p>` }
    const pending = collectBodyFieldRefs(detail).filter((entry: { refs: unknown[] }) => entry.refs.length)
    expect(pending).toHaveLength(1)
    expect(pending[0].field).toBe('recommendation')
    expect(pending[0].refs.map((ref: { key: string }) => ref.key)).toEqual(['uploads/1614096729IMG_6960.JPG'])
    expect(pending[0].original).toBe(detail.recommendation)
  })

  it('пустое поле не попадает в очередь, но остаётся в срезе', () => {
    const entries = collectBodyFieldRefs({ recommendation: `<img src="${LEGACY}">` })
    const empty = entries.find((entry: { field: string }) => entry.field === 'plus')
    expect(empty.original).toBe('')
    expect(empty.refs).toEqual([])
    expect(empty.httpRefs).toBe(0)
  })

  it('считает http-ссылки на свои домены отдельно от кадров', () => {
    const entries = collectBodyFieldRefs({ minus: '<p><a href="http://metravel.by/travels/x">тут</a></p>' })
    const minus = entries.find((entry: { field: string }) => entry.field === 'minus')
    expect(minus.refs).toEqual([])
    expect(minus.httpRefs).toBe(1)
  })

  it('describeRefs печатает только непустые категории', () => {
    const entries = collectBodyFieldRefs({ recommendation: `<img src="${LEGACY}">` })
    const rec = entries.find((entry: { field: string }) => entry.field === 'recommendation')
    expect(describeRefs(rec)).toBe('legacy 1')
  })
})

describe('assertOnlyAddressesChanged', () => {
  const LEGACY = 'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1614096729IMG_6960.JPG'
  const CANONICAL = 'https://metravel.by/travel-description-image/290-abc.webp'
  const original = `<p>Рекомендации</p><img src="${LEGACY}" alt="замок">`

  it('пропускает замену адреса и называет поле в ошибке', () => {
    const next = original.split(LEGACY).join(CANONICAL)
    expect(() => assertOnlyAddressesChanged('recommendation', original, next)).not.toThrow()
  })

  it('ловит оставшийся legacy-кадр', () => {
    expect(() => assertOnlyAddressesChanged('recommendation', original, original)).toThrow(
      /recommendation: в теле остались legacy-ссылки/,
    )
  })

  it('ловит задетый текст', () => {
    const next = `<p>Рекомендации и ещё слово</p><img src="${CANONICAL}" alt="замок">`
    expect(() => assertOnlyAddressesChanged('recommendation', original, next)).toThrow(
      /recommendation: текст статьи изменился/,
    )
  })

  it('ловит пропавшую картинку', () => {
    expect(() => assertOnlyAddressesChanged('recommendation', original, '<p>Рекомендации</p>')).toThrow(
      /recommendation: число <img> изменилось: 1 → 0/,
    )
  })
})
