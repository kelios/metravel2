const {
  KNOWN_BROKEN_FAMILIES,
  legacyKeyExtension,
  auditArticleBodyLadder,
  auditDerivativeCoverage,
  collectArticleBodyMediaUrls,
  collectArticleBodyRungs,
  extractTargetsFromPayloads,
  familyOfMediaUrl,
  isBackpressureResponse,
  mapWithConcurrency,
  toLegacyTarget,
  toTargetUrl,
  toTargetUrlWithQuery,
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

  // Обе ступени семейства из таблицы взяты из `IMAGE_STORAGE_POLICY_V1`, то есть
  // производная в эту ширину объявлена контрактом, а ширины мастера в таблице нет
  // вовсе (контрактный тест `postDeployMediaWidths`) — мастер тут провал бюджета
  // на любой из ступеней, мягкой градации не осталось (#1215/#1373).
  it('мастер вместо производной: у семейства из контракта ошибка на обеих ступенях', () => {
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
    expect(master.find((issue: { message: string }) => issue.message.includes(`w=${large}`))?.severity).toBe('error')
  })

  // Семейство вне таблицы меряется `DEFAULT_WIDTHS`, то есть ступенями наугад:
  // верхней производной ровно в 800 у него может не быть вовсе, и валить деплой
  // по собственной догадке гейт не должен.
  it('семейство вне таблицы: мастер на верхней ступени — предупреждение', () => {
    const result = validateTarget(target('unknown-family'), probes({}, { transform: 'stored-master' }))

    const master = result.issues.filter(
      (issue: { code: string }) => issue.code === 'media.master_instead_of_derivative'
    )
    expect(master).toHaveLength(1)
    expect(master[0].severity).toBe('warning')
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

/**
 * Shrink-профиль `article_body` (бэкенд-коммит `9136878`, #1373): производные —
 * только 480/800/960/1600, ширина мастера 1920 отдаётся мастером с `no-store` и в
 * обход гейта не входит вовсе. Отдельная проба ширины мастера
 * (`MASTER_DERIVATIVE_BY_FAMILY`) не вернётся — требование «мастерская ширина
 * обслуживается производной» противоречило бы контракту хранения. Здесь
 * проверяется, что строгость не потерялась: верхняя ступень 1600 обходится каждым
 * прогоном, и мастер на ней валит гейт.
 */
describe('post-deploy media check: потолок articleBody — производная 1600, не мастер (#1373)', () => {
  const FAMILY = 'travel-description-image'
  const descriptionTarget = () => ({
    family: FAMILY,
    url: `${SITE}/${FAMILY}/543/description/abc.webp`,
    source: '/api/travels/',
  })

  it('обход спрашивает крайние производные shrink-профиля, а не ширину мастера', () => {
    expect(widthsFor(FAMILY)).toEqual({ small: 480, large: 1600 })
  })

  it('мастер на верхней ступени валит гейт, а не предупреждает', () => {
    const { large } = widthsFor(FAMILY)
    const result = validateTarget(
      descriptionTarget(),
      probes({ transform: 'stored-derivative' }, { transform: 'stored-master', cacheControl: 'no-store' })
    )

    const issue = result.issues.find(
      (item: { code: string }) => item.code === 'media.master_instead_of_derivative'
    )
    expect(issue.severity).toBe('error')
    expect(issue.message).toContain(`w=${large}`)
    expect(result.issues.map((item: { code: string }) => item.code)).toContain(
      'media.cache_control.no_store'
    )
  })

  it('честная производная на верхней ступени проходит чисто', () => {
    const result = validateTarget(
      descriptionTarget(),
      probes({ transform: 'stored-derivative' }, { transform: 'stored-derivative' })
    )

    expect(result.issues).toEqual([])
  })
})

// #1251: 50 ключей были физически WebP, но с именем `....JPG` — мастер отдавался
// как image/jpeg. Ступени ширины этого не видят: производные всегда `.webp`.
describe('post-deploy media check: ключ обязан быть .webp (#1251)', () => {
  const keyTarget = (url: string, family = 'gallery') => ({ family, url, source: '/api/travels/' })

  it('ловит legacy-расширение ключа и называет тикет', () => {
    const result = validateTarget(
      keyTarget(`${SITE}/gallery/541/gallery/aaf5b8e791894ca2853d74ebe88febcb.JPG`),
      probes({ transform: 'stored-derivative' }, { transform: 'stored-derivative' })
    )

    const issue = result.issues.find((item: { code: string }) => item.code === 'media.key_extension')
    expect(issue.severity).toBe('error')
    expect(issue.message).toContain('#1251')
  })

  it('переименованный ключ проходит чисто', () => {
    expect(
      legacyKeyExtension(keyTarget(`${SITE}/gallery/541/gallery/aaf5b8e79189.webp`))
    ).toBeNull()
  })

  it('legacy-классы не трогаются: там расширение соответствует формату by design', () => {
    expect(
      legacyKeyExtension(keyTarget(`${SITE}/travel-image/682/conversions/abc-detail_hd.jpg`, 'travel-image'))
    ).toBeNull()
    expect(
      legacyKeyExtension(keyTarget(`${SITE}/travel-description-image/uploads/2019/06/foto.jpg`, 'travel-description-image'))
    ).toBeNull()
  })

  it('описание тела статьи проверяется так же, как галерея', () => {
    expect(
      legacyKeyExtension(keyTarget(`${SITE}/travel-description-image/543/description/abc.PNG`, 'travel-description-image'))
    ).toBe('png')
  })
})

// #1261: гейт обходит КАЖДУЮ ступень `media.article_body[*].srcset`, а не первую
// подходящую. Ровно на этом дефект #1260 доехал до прода: 14 битых URL из 222 в
// одной статье при зелёном гейте на всех шести семействах.
describe('post-deploy media check: лестницы media.article_body (#1261)', () => {
  const addressBase = `${SITE}/address-image/15601/conversions/db98.webp`
  const galleryBase = `${SITE}/gallery/541/gallery/aaf5.webp`

  const srcsetOf = (base: string, widths: readonly number[]) =>
    widths.map((width) => `${base}?w=${width} ${width}w`).join(', ')

  const detailWith = (items: unknown[]) => ({ media: { article_body: { gallery: items } } })

  const ladderResponse = (overrides: { status?: number; transform?: string } = {}) => ({
    status: overrides.status ?? 200,
    bytes: 1000,
    transform: overrides.transform ?? 'dynamic-transform-cache',
    headers: { 'x-metravel-image-transform': overrides.transform ?? 'dynamic-transform-cache' },
  })

  const rungsOf = (widths: readonly number[], family = 'address-image') =>
    widths.map((width) => ({ url: `${SITE}/x?w=${width}`, width, family }))

  describe('сбор ступеней', () => {
    it('берёт каждую ступень каждого srcset-поля, а не первую подходящую', () => {
      const rungs = collectArticleBodyRungs(
        detailWith([
          {
            src: `${addressBase}?w=960`,
            srcset: srcsetOf(addressBase, [320, 640, 960]),
            srcset_contain: srcsetOf(addressBase, [320, 640, 960]),
            storage_policy: { profile: 'route_point' },
          },
        ]),
        SITE
      )

      expect(rungs.map((rung: { width: number }) => rung.width)).toEqual([320, 640, 960, 320, 640, 960])
      expect(rungs.every((rung: { family: string }) => rung.family === 'address-image')).toBe(true)
      expect(rungs[0].url).toBe(`${SITE}/address-image/15601/conversions/db98.webp?w=320`)
    })

    it('различает семейства внутри одного тела', () => {
      const rungs = collectArticleBodyRungs(
        detailWith([
          { srcset: srcsetOf(addressBase, [320]) },
          { srcset: srcsetOf(galleryBase, [1600]) },
        ]),
        SITE
      )

      expect(rungs.map((rung: { family: string }) => rung.family)).toEqual(['address-image', 'gallery'])
    })

    it('пропускает прямые ссылки в бакет: они не на проверяемом origin и игнорят ?w=', () => {
      const bucket = 'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350.jpg'
      const rungs = collectArticleBodyRungs(detailWith([{ srcset: srcsetOf(bucket, [320, 800]) }]), SITE)

      expect(rungs).toEqual([])
    })

    it('пустой и отсутствующий манифест не роняют сбор', () => {
      expect(collectArticleBodyRungs(null, SITE)).toEqual([])
      expect(collectArticleBodyRungs({}, SITE)).toEqual([])
      expect(collectArticleBodyRungs(detailWith([{ srcset: null }]), SITE)).toEqual([])
    })

    it('семейство определяется и для legacy-роутов', () => {
      expect(familyOfMediaUrl(`${SITE}/address-image/1/conversions/a.webp`, SITE)).toBe('address-image')
      expect(familyOfMediaUrl(`${SITE}/media-resize/legacy/1/conversions/a.webp`, SITE)).toBe('media-resize-legacy')
      expect(familyOfMediaUrl(`${SITE}/media-resize/uploads/a.jpg`, SITE)).toBe('media-resize-uploads')
      expect(familyOfMediaUrl('', SITE)).toBeNull()
    })

    it('ширина ступени живёт в query, поэтому query цели сохраняется', () => {
      expect(toTargetUrlWithQuery(SITE, 'https://cdn.metravel.by/gallery/a.webp?w=800')).toBe(
        `${SITE}/gallery/a.webp?w=800`
      )
    })
  })

  describe('разбор ответов', () => {
    it('любой не-200 на ступени — ошибка', () => {
      const { issues } = auditArticleBodyLadder([
        { rung: rungsOf([320])[0], response: ladderResponse() },
        { rung: rungsOf([960])[0], response: ladderResponse({ status: 400 }) },
      ])

      const failures = issues.filter((issue: { code: string }) => issue.code === 'media.article_body.rung_status')
      expect(failures).toHaveLength(1)
      expect(failures[0].severity).toBe('error')
      expect(failures[0].message).toContain('w=960')
    })

    it('derivative-missing — ошибка даже при 200: читатель видит битое фото', () => {
      const { issues } = auditArticleBodyLadder([
        { rung: rungsOf([320])[0], response: ladderResponse({ transform: 'derivative-missing' }) },
      ])

      expect(issues.map((issue: { code: string }) => issue.code)).toContain(
        'media.article_body.rung_derivative_missing'
      )
    })

    it('ступень выше верхней производной семейства — это класс #1260', () => {
      const { issues } = auditArticleBodyLadder(
        rungsOf([320, 960, 1600]).map((rung) => ({ rung, response: ladderResponse() }))
      )

      const exceeded = issues.filter(
        (issue: { code: string }) => issue.code === 'media.article_body.ladder_exceeds_family'
      )
      expect(exceeded).toHaveLength(1)
      expect(exceeded[0].severity).toBe('error')
      expect(exceeded[0].message).toContain('960')
    })

    it('лестница ровно по потолок семейства — чисто', () => {
      const { issues, families } = auditArticleBodyLadder(
        rungsOf([320, 480, 640, 800, 960]).map((rung) => ({ rung, response: ladderResponse() }))
      )

      expect(issues).toEqual([])
      expect(families).toEqual([
        { family: 'address-image', checked: 5, failed: 0, maxWidth: 960, minWidth: 320 },
      ])
    })

    it('gallery сохраняет 1600, address-image заканчивается на 960', () => {
      const { issues } = auditArticleBodyLadder([
        ...rungsOf([320, 960]).map((rung) => ({ rung, response: ladderResponse() })),
        ...rungsOf([96, 1600], 'gallery').map((rung) => ({ rung, response: ladderResponse() })),
      ])

      expect(issues.filter((issue: { severity: string }) => issue.severity === 'error')).toEqual([])
    })

    it('потерянная верхняя ступень — предупреждение, а не тишина', () => {
      const { issues } = auditArticleBodyLadder(
        rungsOf([96, 960], 'gallery').map((rung) => ({ rung, response: ladderResponse() }))
      )

      const below = issues.filter(
        (issue: { code: string }) => issue.code === 'media.article_body.ladder_below_family'
      )
      expect(below).toHaveLength(1)
      expect(below[0].severity).toBe('warning')
    })

    it('незнакомое семейство не сверяется с потолком, но обходится', () => {
      const { issues, families } = auditArticleBodyLadder(
        rungsOf([9999], 'unknown-family').map((rung) => ({ rung, response: ladderResponse() }))
      )

      expect(issues).toEqual([])
      expect(families[0].checked).toBe(1)
    })
  })

  describe('backpressure отделён от дефекта контракта', () => {
    it('503 и capacity-rejected считаются нагрузкой, а не поломкой', () => {
      expect(isBackpressureResponse({ status: 503 })).toBe(true)
      expect(isBackpressureResponse({ status: 200, transform: 'capacity-rejected' })).toBe(true)
      expect(isBackpressureResponse({ status: 400, transform: 'derivative-missing' })).toBe(false)
      expect(isBackpressureResponse({ status: 200, transform: 'dynamic-transform-cache' })).toBe(false)
    })
  })

  describe('ограничение параллелизма', () => {
    it('сохраняет порядок результатов и не превышает лимит', async () => {
      let active = 0
      let peak = 0
      const items = Array.from({ length: 10 }, (_, index) => index)

      const results = await mapWithConcurrency(items, 3, async (item: number) => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 1))
        active -= 1
        return item * 2
      })

      expect(results).toEqual(items.map((item) => item * 2))
      expect(peak).toBeLessThanOrEqual(3)
    })
  })
})

/**
 * Режим раздачи (#1201/#1168).
 *
 * Проверка появилась после того, как `article_body` шесть дней провисел на
 * динамике незамеченным: покрытие упало с 100 % до 84,3 %, потому что миграция
 * тел статей и чистка base64 перезалили тысячи кадров уже после прогона #1180.
 * Ответы при этом оставались 200 — поймать откат мог только контракт.
 */
describe('auditDerivativeCoverage', () => {
  const familyMode = (over: Record<string, unknown> = {}) => ({
    requested_mode: 'durable_s3_derivatives',
    active_mode: 'durable_s3_derivatives',
    coverage: { masters: 100, complete_masters: 100, coverage_percent: 100, complete: true },
    ...over,
  })

  const contractWith = (families: Record<string, unknown>) => ({
    route_behavior: { model_owned: { family_modes: families } },
  })

  it('откат на динамику при запрошенном durable — ошибка', () => {
    const { issues } = auditDerivativeCoverage(
      contractWith({
        article_body: familyMode({
          active_mode: 'dynamic_transform',
          coverage: {
            masters: 6650,
            complete_masters: 5607,
            coverage_percent: 84.315789,
            complete: false,
          },
        }),
      }),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].code).toBe('coverage.mode_regressed')
    expect(issues[0].message).toContain('84.3')
    expect(issues[0].message).toContain('5607 из 6650')
  })

  it('покрытое семейство ошибок не даёт', () => {
    const { families, issues } = auditDerivativeCoverage(contractWith({ travel: familyMode() }))
    expect(issues).toEqual([])
    expect(families[0]).toMatchObject({ family: 'travel', complete: true, coveragePercent: 100 })
  })

  it('durable-режим при неполном покрытии — предупреждение, а не ошибка', () => {
    const { issues } = auditDerivativeCoverage(
      contractWith({
        travel: familyMode({
          coverage: { masters: 10, complete_masters: 9, coverage_percent: 90, complete: false },
        }),
      }),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].code).toBe('coverage.incomplete')
  })

  it('семейство без мастеров пропускается: покрывать нечего', () => {
    const { families, issues } = auditDerivativeCoverage(
      contractWith({
        badge: familyMode({ active_mode: 'dynamic_transform', coverage: { masters: 0 } }),
      }),
    )
    expect(issues).toEqual([])
    expect(families).toEqual([])
  })

  it('недоступный контракт — ошибка, а не молчаливый зелёный', () => {
    for (const broken of [null, undefined, {}, { route_behavior: null }]) {
      const { issues } = auditDerivativeCoverage(broken as never)
      expect(issues.map((issue: { code: string }) => issue.code)).toEqual([
        'coverage.contract_unreadable',
      ])
    }
  })

  it('обходит все классы ключей, а не только model_owned', () => {
    const { families } = auditDerivativeCoverage({
      route_behavior: {
        model_owned: { family_modes: { travel: familyMode() } },
        legacy_conversion: { family_modes: { travel: familyMode() } },
      },
    })
    expect(families.map((f: { keyClass: string }) => f.keyClass)).toEqual([
      'model_owned',
      'legacy_conversion',
    ])
  })

  it('проверяет per-object режим contract v12 без family_modes', () => {
    const { families, issues } = auditDerivativeCoverage({
      route_behavior: {
        model_owned: { default_mode: 'per_object_derivative' },
        legacy_upload: { default_mode: 'per_object_derivative' },
        legacy_conversion: { default_mode: 'per_object_derivative' },
      },
    })

    expect(issues).toEqual([])
    expect(families).toHaveLength(3)
    expect(families[0]).toMatchObject({
      family: '*',
      requestedMode: 'per_object_derivative',
      activeMode: 'per_object_derivative',
      contractMode: 'per_object',
    })
  })

  it('не пропускает откат или неизвестную схему contract v12', () => {
    expect(auditDerivativeCoverage({
      route_behavior: { model_owned: { default_mode: 'dynamic_transform' } },
    }).issues).toEqual([
      expect.objectContaining({ severity: 'error', code: 'delivery.mode_regressed' }),
    ])

    expect(auditDerivativeCoverage({
      route_behavior: { model_owned: { routes: ['/gallery/'] } },
    }).issues).toEqual([
      expect.objectContaining({ severity: 'error', code: 'coverage.contract_unreadable' }),
    ])
  })
})
