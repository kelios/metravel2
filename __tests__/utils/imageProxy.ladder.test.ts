import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  optimizeImageUrl,
  PROXY_QUALITY_LADDER,
  snapProxyQuality,
} from '@/utils/imageProxy'

/**
 * Лестница ширин фронта обязана совпадать с `ALLOWED_IMAGE_WIDTHS` бэкенда.
 *
 * Расхождение стоило проекту шести тикетов подряд (#1104, #1112, #1113, #1120,
 * #1103, #1170) — каждый раз фронт просил ширину, которой у прокси нет, и получал
 * либо оригинал целиком, либо ближайшую ступень сильно выше нужной.
 *
 * Снимок ниже — ответ `GET https://metravel.by/api/media/proxy-contract` на
 * 2026-08-02. Прод отдаёт `version: 4` (в нём добавился `route_behavior` с
 * family- и legacy-роутами); наборы ширин и quality в нём те же, что и в v3.
 * Обновлять снимок следует только вместе с бэкендом: смена набора ступеней —
 * двусторонний релиз, см. `docs/features/images.md` §6.
 */
const BACKEND_CONTRACT_WIDTHS = [
  32, 96, 160, 320, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1600, 1920, 2500,
] as const

const BACKEND_CONTRACT_QUALITIES = [20, 30, 40, 50, 60, 70, 80, 85, 90] as const

const MEDIA_URL = 'https://metravel.by/gallery/682/gallery/sample.webp'

const widthOf = (requested: number): number | null => {
  const optimized = optimizeImageUrl(MEDIA_URL, { width: requested })
  if (!optimized) return null
  const raw = new URL(optimized).searchParams.get('w')
  return raw === null ? null : Number(raw)
}

describe('utils/imageProxy — лестница ширин против контракта прокси', () => {
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = previousApiUrl
  })

  it('каждая ступень контракта запрашивается как есть, без снэпа вверх', () => {
    for (const width of BACKEND_CONTRACT_WIDTHS) {
      expect({ width, got: widthOf(width) }).toEqual({ width, got: width })
    }
  })

  it('промежуточное значение округляется вверх до ближайшей ступени контракта', () => {
    const cases: Array<[requested: number, expected: number]> = [
      [1, 32],
      [47, 96],
      [240, 320],
      [700, 720],
      [736, 800], // слот 368 CSS × DPR 2 — случай #1170
      [780, 800],
      [840, 960], // слот 420 CSS × DPR 2 — карточка квеста на десктопе
      [1000, 1024],
      [1300, 1600],
    ]
    for (const [requested, expected] of cases) {
      expect({ requested, got: widthOf(requested) }).toEqual({ requested, got: expected })
    }
  })

  it('выше верхней ступени клампится, а не растёт бесконечно', () => {
    const max = BACKEND_CONTRACT_WIDTHS[BACKEND_CONTRACT_WIDTHS.length - 1]
    expect(widthOf(max + 1)).toBe(max)
    expect(widthOf(9999)).toBe(max)
  })

  it('не появляется ступеней, которых нет в контракте', () => {
    const produced = new Set<number>()
    for (let requested = 1; requested <= 2600; requested += 1) {
      const got = widthOf(requested)
      if (got !== null) produced.add(got)
    }
    const unexpected = [...produced].filter(
      (value) => !BACKEND_CONTRACT_WIDTHS.includes(value as (typeof BACKEND_CONTRACT_WIDTHS)[number]),
    )
    expect(unexpected).toEqual([])
  })

  it('SSG-зеркало лестницы не разошлось с рантайм-лестницей', () => {
    // `scripts/generate-seo-pages.js` исполняется Node'ом без TS-резолва, поэтому
    // держит собственную копию лестницы. Расхождение ломает #1146: SSG-preload
    // греет один вариант hero, а рантайм-слайдер просит другой, и одно и то же фото
    // приезжает двумя файлами (+211 158 B по замеру из #1143).
    //
    // Ровно это и произошло при правке #1170: рантайм получил ступень 720, зеркало
    // осталось на 800.
    const source = readFileSync(
      resolve(__dirname, '..', '..', 'scripts', 'generate-seo-pages.js'),
      'utf8',
    )
    const match = source.match(/const PROXY_DIMENSION_LADDER = \[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const mirrored = match![1]
      .split(',')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0)
      .map(Number)
    expect(mirrored).toEqual([...BACKEND_CONTRACT_WIDTHS])
  })

  it('quality-лестница включает q85 и совпадает с backend-contract', () => {
    expect(PROXY_QUALITY_LADDER).toEqual(BACKEND_CONTRACT_QUALITIES)
    expect(snapProxyQuality(72)).toBe(80)
    expect(snapProxyQuality(78)).toBe(80)
    expect(snapProxyQuality(82)).toBe(85)
    expect(snapProxyQuality(85)).toBe(85)
    expect(snapProxyQuality(88)).toBe(90)
    expect(snapProxyQuality(0)).toBe(85)
    expect(snapProxyQuality(150)).toBe(85)

    const source = readFileSync(
      resolve(__dirname, '..', '..', 'scripts', 'generate-seo-pages.js'),
      'utf8',
    )
    const match = source.match(/const PROXY_QUALITY_LADDER = \[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const mirrored = match![1]
      .split(',')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0)
      .map(Number)
    expect(mirrored).toEqual([...BACKEND_CONTRACT_QUALITIES])
  })

  it('ступени 720/960/1024/1200 обслуживаются — без них ×1.5-кандидат srcSet схлопывался в 1280', () => {
    // Регрессия #1170: слот 368 CSS @DPR2 требовал 780, а в лестнице между 640 и
    // 1280 не было ничего, поэтому браузер брал 1280 — 132 344 B вместо 53 104 B.
    for (const width of [720, 960, 1024, 1200]) {
      expect(widthOf(width)).toBe(width)
    }
    expect(widthOf(960)).not.toBe(1280)
  })
})
