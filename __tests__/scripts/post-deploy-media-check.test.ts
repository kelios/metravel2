const {
  KNOWN_BROKEN_FAMILIES,
  collectArticleBodyMediaUrls,
  extractTargetsFromPayloads,
  toLegacyTarget,
  toTargetUrl,
  toUploadsTarget,
  uploadsScanPages,
  validateTarget,
  widthsFor,
  withWidth,
} = require('@/scripts/post-deploy-media-check')

const SITE = 'https://metravel.by'

/** Ступени теперь свои у каждого семейства; тесты идут по `travel-image`. */
const { small: SMALL_WIDTH, large: LARGE_WIDTH } = widthsFor('travel-image')

type ProbeOverrides = {
  status?: number
  bytes?: number
  contentType?: string
  transform?: string
  cacheControl?: string
}

const response = ({
  status = 200,
  bytes = 1000,
  contentType = 'image/webp',
  transform = 'dynamic-transform-cache',
  cacheControl = 'public, max-age=31536000, immutable',
}: ProbeOverrides = {}) => ({
  status,
  bytes,
  headers: {
    'content-type': contentType,
    'x-metravel-image-transform': transform,
    'cache-control': cacheControl,
  },
})

const probes = (small: ProbeOverrides = {}, large: ProbeOverrides = {}) => [
  {
    accept: 'browser',
    small: response({ bytes: 2582, ...small }),
    large: response({ bytes: 132344, ...large }),
  },
]

const target = (family = 'travel-image') => ({
  family,
  url: `${SITE}/travel-image/682/conversions/abc.webp`,
  source: '/api/travels/',
})

describe('post-deploy media check: разбор контракта', () => {
  it('строит цели по одной на семейство из публичных payload’ов', () => {
    const targets = extractTargetsFromPayloads(SITE, {
      travels: {
        data: [
          {
            id: 682,
            media: { cover: { variants: { original: '/travel-image/682/conversions/cover.webp' } } },
          },
        ],
      },
      travelDetail: {
        data: {
          gallery: [{ url: `${SITE}/gallery/photo.webp` }],
          travelAddress: [
            { travelImageThumbUrl: null, travelImageUrl: null },
            { travelImageThumbUrl: `${SITE}/address-image/15850/conversions/point.webp` },
          ],
        },
      },
      quests: { data: [{ cover_url: `${SITE}/quest-cover/quests/1/main/cover.webp` }] },
    })

    expect(targets.map((item: { family: string }) => item.family)).toEqual([
      'travel-image',
      'gallery',
      'address-image',
      'quest-cover',
      'media-resize-legacy',
    ])
    expect(targets[0].url).toBe(`${SITE}/travel-image/682/conversions/cover.webp`)
    expect(targets[2].url).toBe(`${SITE}/address-image/15850/conversions/point.webp`)
  })

  it('не хардкодит id: цели меняются вместе с ответом API', () => {
    const targets = extractTargetsFromPayloads(SITE, {
      travels: { results: [{ id: 999, travel_image_thumb_url: `${SITE}/travel-image/999/conversions/x.webp` }] },
    })

    expect(targets[0].url).toBe(`${SITE}/travel-image/999/conversions/x.webp`)
  })

  it('переносит медиа-URL на проверяемый origin', () => {
    expect(toTargetUrl('https://dev.metravel.by', `${SITE}/gallery/photo.webp`)).toBe(
      'https://dev.metravel.by/gallery/photo.webp'
    )
    expect(toTargetUrl(SITE, '/gallery/photo.webp')).toBe(`${SITE}/gallery/photo.webp`)
  })

  it('строит legacy-цель из conversion-ключа и отказывается от остальных', () => {
    expect(toLegacyTarget(SITE, `${SITE}/travel-image/682/conversions/abc.webp`)).toBe(
      `${SITE}/media-resize/legacy/682/conversions/abc.webp`
    )
    expect(toLegacyTarget(SITE, `${SITE}/gallery/plain.webp`)).toBeNull()
  })

  it('берёт для legacy первый кандидат, из которого путь реально строится', () => {
    const targets = extractTargetsFromPayloads(SITE, {
      // Обложка без `/conversions/` для legacy не годится — цель должна прийти
      // из точки маршрута, а не пропасть вместе с первым кандидатом.
      travels: { data: [{ id: 1, travel_image_thumb_url: `${SITE}/travel-image/plain.webp` }] },
      travelDetail: {
        data: { travelAddress: [{ travelImageThumbUrl: `${SITE}/address-image/9/conversions/p.webp` }] },
      },
    })

    expect(targets.find((item: { family: string }) => item.family === 'media-resize-legacy')?.url).toBe(
      `${SITE}/media-resize/legacy/9/conversions/p.webp`
    )
  })

  it('подставляет ширину, не теряя остальные параметры', () => {
    expect(withWidth(`${SITE}/gallery/photo.webp?f=webp`, SMALL_WIDTH)).toBe(
      `${SITE}/gallery/photo.webp?f=webp&w=${SMALL_WIDTH}`
    )
  })
})

describe('post-deploy media check: цель uploads/** (фото тела старых статей)', () => {
  const S3 = 'https://metravelprod.s3.eu-north-1.amazonaws.com'

  it('строит цель из ссылки манифеста на бакет — без префикса legacy/', () => {
    // Правило `isLegacyUploadKey` из `utils/mediaUrl.ts`: класс `uploads/**`
    // обслуживает `/media-resize/<key>`, а не `/media-resize/legacy/<key>`.
    //
    // #1233: цель несёт `f=jpeg` — ровно ту ветку, которой этот класс теперь
    // спрашивается фронтом (`LEGACY_UPLOAD_TRANSFORM_FORMAT`). Гейт обязан щупать
    // URL читателя: дефолтная webp-ветка у `uploads/**` отвечает 404 на каждой
    // ступени, и без `f` гейт валил бы деплой на URL, который никто не запрашивает.
    expect(toUploadsTarget(SITE, `${S3}/uploads/1593619453IMG_6420.JPG`)).toBe(
      `${SITE}/media-resize/uploads/1593619453IMG_6420.JPG?f=jpeg`
    )
    expect(toUploadsTarget(SITE, '/uploads/articles/legacy.jpg')).toBe(
      `${SITE}/media-resize/uploads/articles/legacy.jpg?f=jpeg`
    )
  })

  it('отказывается от всего, что не является legacy-ключом картинки', () => {
    expect(toUploadsTarget(SITE, `${SITE}/gallery/photo.webp`)).toBeNull()
    expect(toUploadsTarget(SITE, `${S3}/uploads/`)).toBeNull()
    expect(toUploadsTarget(SITE, `${S3}/uploads/notes.pdf`)).toBeNull()
    expect(toUploadsTarget(SITE, `${S3}/uploads/../secrets/key.jpg`)).toBeNull()
    expect(toUploadsTarget(SITE, '')).toBeNull()
  })

  it('достаёт медиа тела статьи из манифеста: обложка и галерея', () => {
    const urls = collectArticleBodyMediaUrls({
      media: {
        article_body: {
          cover: { src: `${S3}/uploads/cover.jpg` },
          gallery: [
            { src: `${S3}/uploads/a.JPG`, variants: { original: `${S3}/uploads/a.JPG` } },
            null,
            { variants: { original: `${S3}/uploads/b.jpg` } },
          ],
        },
      },
    })

    expect(urls).toEqual([
      `${S3}/uploads/cover.jpg`,
      `${S3}/uploads/a.JPG`,
      `${S3}/uploads/a.JPG`,
      `${S3}/uploads/b.jpg`,
    ])
    expect(collectArticleBodyMediaUrls({ media: {} })).toEqual([])
    expect(collectArticleBodyMediaUrls(null)).toEqual([])
  })

  it('берёт ключ из любой просмотренной статьи, а не только из первой', () => {
    // У свежих статей `uploads/**` нет вообще — цель обязана прийти из той
    // статьи каталога, где legacy-фото действительно есть (#1222).
    const targets = extractTargetsFromPayloads(SITE, {
      travels: { results: [{ id: 682, travel_image_thumb_url: `${SITE}/travel-image/682/conversions/c.webp` }] },
      travelDetail: { data: { media: { article_body: { gallery: [{ src: `${SITE}/travel-description-image/9/x.webp` }] } } } },
      travelDetails: [
        { data: { media: { article_body: { gallery: [] } } } },
        { data: { media: { article_body: { gallery: [{ src: `${S3}/uploads/1591977314DSC_0375.JPG` }] } } } },
      ],
    })

    expect(targets.find((item: { family: string }) => item.family === 'media-resize-uploads')?.url).toBe(
      `${SITE}/media-resize/uploads/1591977314DSC_0375.JPG?f=jpeg`
    )
  })

  it('без legacy-ключей цели просто нет — гейт не выдумывает URL', () => {
    const targets = extractTargetsFromPayloads(SITE, {
      travels: { results: [{ id: 682, travel_image_thumb_url: `${SITE}/travel-image/682/conversions/c.webp` }] },
      travelDetails: [{ data: { media: { article_body: { gallery: [{ src: `${SITE}/travel-description-image/9/x.webp` }] } } } }],
    })

    expect(targets.some((item: { family: string }) => item.family === 'media-resize-uploads')).toBe(false)
  })

  it('ищет legacy-ключ в сечениях каталога, а не на его краю', () => {
    // Замер 2026-08-03: страницы 1–4 и 20 из 20 почти пустые, 5–19 — 50–95%.
    const pages = uploadsScanPages({ count: 397, results: new Array(20).fill({ id: 1 }) })

    expect(pages).toEqual([10, 15, 5])
    expect(uploadsScanPages({})).toEqual([1])
  })
})

describe('post-deploy media check: проверки ответа', () => {
  it('позитивный кейс: разные ступени и кэшируемый ответ — гейт чист', () => {
    const result = validateTarget(target(), probes())
    expect(result.issues).toEqual([])
  })

  it('НЕГАТИВНАЯ ПРОБА: одинаковый вес на разных ширинах валит гейт', () => {
    const result = validateTarget(target(), probes({ bytes: 132344 }, { bytes: 132344 }))

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({ severity: 'error', code: 'media.width_invariant' })
    expect(result.issues[0].message).toContain(`w=${SMALL_WIDTH}`)
    expect(result.issues[0].message).toContain(`w=${LARGE_WIDTH}`)
    expect(result.issues[0].message).toContain('132344')
  })

  it('ловит source-pass-through даже при валидной картинке и 200', () => {
    const result = validateTarget(target(), probes({ transform: 'source-pass-through' }))

    expect(result.issues.map((issue: { code: string }) => issue.code)).toContain('media.source_pass_through')
    expect(result.issues[0].severity).toBe('error')
  })

  it('ловит no-store и отсутствие public/max-age', () => {
    const noStore = validateTarget(target(), probes({ cacheControl: 'no-store' }))
    expect(noStore.issues.map((issue: { code: string }) => issue.code)).toContain('media.cache_control.no_store')

    const noPublic = validateTarget(target(), probes({ cacheControl: 'max-age=60' }))
    expect(noPublic.issues.map((issue: { code: string }) => issue.code)).toContain('media.cache_control.missing')
  })

  it('НЕГАТИВНАЯ ПРОБА: 404 derivative-missing валит гейт — это битое фото у читателя', () => {
    // Ровно тот ответ, который прод отдавал по #1222: производной нет, мастер
    // при этом на месте, страница показывает пустой прямоугольник.
    const result = validateTarget(
      target('media-resize-uploads'),
      probes(
        { status: 404, bytes: 0, contentType: 'text/html; charset=utf-8', transform: 'derivative-missing', cacheControl: 'no-store' },
        { status: 404, bytes: 0, contentType: 'text/html; charset=utf-8', transform: 'derivative-missing', cacheControl: 'no-store' }
      )
    )

    const codes = result.issues.map((issue: { code: string }) => issue.code)
    expect(codes).toContain('media.derivative_missing')
    expect(codes).toContain('media.status')
    expect(
      result.issues
        .filter((issue: { code: string }) => issue.code === 'media.derivative_missing')
        .every((issue: { severity: string }) => issue.severity === 'error')
    ).toBe(true)
  })

  it('мастер вместо производной: на минимальной ступени — ошибка, на верхней — предупреждение', () => {
    const { small, large } = widthsFor('media-resize-uploads')
    const result = validateTarget(
      target('media-resize-uploads'),
      probes({ transform: 'stored-master' }, { transform: 'stored-master' })
    )

    const master = result.issues.filter(
      (issue: { code: string }) => issue.code === 'media.master_instead_of_derivative'
    )
    expect(master).toHaveLength(2)
    expect(master.find((issue: { message: string }) => issue.message.includes(`w=${small}`))?.severity).toBe('error')
    expect(master.find((issue: { message: string }) => issue.message.includes(`w=${large}`))?.severity).toBe('warning')
  })

  it('штатный stored-derivative тревогу не поднимает', () => {
    const result = validateTarget(target('media-resize-uploads'), probes({ transform: 'stored-derivative' }, { transform: 'stored-derivative' }))

    expect(result.issues).toEqual([])
  })

  it('ловит не-200 и не-изображение', () => {
    const result = validateTarget(
      target(),
      probes({}, { status: 503, bytes: 0, contentType: 'text/html; charset=utf-8' })
    )

    const codes = result.issues.map((issue: { code: string }) => issue.code)
    expect(codes).toContain('media.status')
    expect(codes).toContain('media.content_type')
  })

  it('проверяет обе Accept-ветки: поломка только у краулера тоже валит гейт', () => {
    const result = validateTarget(target(), [
      { accept: 'browser', small: response({ bytes: 2582 }), large: response({ bytes: 132344 }) },
      {
        accept: 'any',
        small: response({ bytes: 132344, transform: 'source-pass-through', cacheControl: 'no-store' }),
        large: response({ bytes: 132344, transform: 'source-pass-through', cacheControl: 'no-store' }),
      },
    ])

    const codes = result.issues.map((issue: { code: string }) => issue.code)
    expect(codes).toContain('media.source_pass_through')
    expect(codes).toContain('media.width_invariant')
    expect(result.issues.every((issue: { message: string }) => issue.message.includes('[accept=any]'))).toBe(true)
  })

  it('известная поломка понижается до предупреждения только с флагом', () => {
    KNOWN_BROKEN_FAMILIES.set('travel-image', '#1195 — тестовая запись')
    try {
      const strict = validateTarget(target(), probes({ transform: 'source-pass-through' }))
      expect(strict.issues[0].severity).toBe('error')

      const lenient = validateTarget(target(), probes({ transform: 'source-pass-through' }), {
        allowKnownBroken: true,
      })
      expect(lenient.issues[0].severity).toBe('warning')
      expect(lenient.issues[0].message).toContain('#1195')

      const otherFamily = validateTarget(target('gallery'), probes({ transform: 'source-pass-through' }), {
        allowKnownBroken: true,
      })
      expect(otherFamily.issues[0].severity).toBe('error')
    } finally {
      KNOWN_BROKEN_FAMILIES.delete('travel-image')
    }
  })

  it('по умолчанию список известных поломок пуст — гейт строгий ко всем семействам', () => {
    expect(KNOWN_BROKEN_FAMILIES.size).toBe(0)
  })
})
