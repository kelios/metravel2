import fs from 'fs'
import path from 'path'

import { countCatalogSources, type Fetcher } from '@/scripts/ai-index/export'
import { chunkId, countSources, indexAgeDays, MANIFEST_FILE, writeIndex, type ChunkRecord } from '@/scripts/ai-index/format'
import { checkFreshness, readFreshnessSubject } from '@/scripts/ai-index/freshness'

import { makeTempDir } from '../cli-test-utils'

const NOW = Date.parse('2026-11-11T12:00:00.000Z')
const DAY = 86_400_000

const makeChunk = (type: ChunkRecord['type'], sourceId: number, locale = 'ru', text = `${type} ${sourceId} ${locale}`): ChunkRecord => ({
  id: chunkId(type, sourceId, locale, text),
  type,
  source_id: sourceId,
  url: `https://metravel.by/${type}/${sourceId}`,
  title: `${type} ${sourceId}`,
  city: null,
  country: null,
  lat: null,
  lng: null,
  month: [],
  tags: [],
  locale,
  text,
  cover: null,
})

const CHUNKS = [
  makeChunk('travel', 816, 'ru', 'первый фрагмент'),
  makeChunk('travel', 816, 'ru', 'второй фрагмент'),
  makeChunk('travel', 761),
  makeChunk('quest', 1, 'ru'),
  makeChunk('quest', 1, 'pl'),
  makeChunk('quest', 2, 'ru'),
]

describe('ai-index: число источников и возраст сборки', () => {
  it('квест на нескольких локалях и статья из нескольких фрагментов — по одному источнику', () => {
    expect(countSources(CHUNKS)).toEqual({ travel: 2, quest: 2 })
    expect(countSources([])).toEqual({ travel: 0, quest: 0 })
  })

  it('возраст — целые дни; будущая дата — ноль, кривая — null', () => {
    expect(indexAgeDays('2026-11-11T00:00:00.000Z', NOW)).toBe(0)
    expect(indexAgeDays('2026-10-18T17:45:23.360Z', NOW)).toBe(23)
    expect(indexAgeDays('2026-11-12T00:00:00.000Z', NOW)).toBe(0)
    expect(indexAgeDays('не дата', NOW)).toBeNull()
    expect(indexAgeDays('', NOW)).toBeNull()
  })

  it('writeIndex пишет число источников в манифест', () => {
    const distDir = makeTempDir('ai-index-sources-')
    const manifest = writeIndex(distDir, { model: 'm', dim: 2, chunks: CHUNKS, vectors: CHUNKS.map(() => [1, 0]) })
    expect(manifest.sources).toEqual({ travel: 2, quest: 2 })
    expect(JSON.parse(fs.readFileSync(path.join(distDir, MANIFEST_FILE), 'utf8')).sources).toEqual({ travel: 2, quest: 2 })
  })
})

describe('ai-index: проверка свежести слепка', () => {
  const fresh = { built_at: new Date(NOW - 2 * DAY).toISOString(), sources: { travel: 434, quest: 343 } }

  it('свежий слепок с числами каталога проходит; допуск 2 % покрывает пустые статьи', () => {
    const report = checkFreshness(fresh, { now: NOW, catalog: { travel: 436, quest: 343 } })
    expect(report).toMatchObject({ ok: true, age_days: 2, problems: [] })
    expect(report.drift?.travel).toBeCloseTo(2 / 436)
    expect(report.drift?.quest).toBe(0)
  })

  it('слепок от 18.10 против каталога 11.11: и возраст, и расхождение квестов', () => {
    const report = checkFreshness(
      { built_at: '2026-10-18T17:45:23.360Z', sources: { travel: 429, quest: 280 } },
      { now: NOW, catalog: { travel: 434, quest: 343 } },
    )
    expect(report.ok).toBe(false)
    expect(report.age_days).toBe(23)
    expect(report.problems).toEqual([
      'слепок собран 23 дн. назад при пороге 7',
      'квестов в слепке 280, в каталоге 343 — расхождение 18.4 % при пороге 2.0 %',
    ])
  })

  it('без каталога проверяется только возраст; порог задаётся', () => {
    const old = { built_at: new Date(NOW - 10 * DAY).toISOString(), sources: null }
    expect(checkFreshness(old, { now: NOW })).toMatchObject({ ok: false, catalog: null, drift: null })
    expect(checkFreshness(old, { now: NOW, maxAgeDays: 14 })).toMatchObject({ ok: true, age_days: 10 })
  })

  it('кривая дата и слепок без числа источников — проблемы, а не «свежо»', () => {
    expect(checkFreshness({ built_at: '' }, { now: NOW }).problems).toEqual(['дата сборки не читается: ""'])
    const report = checkFreshness({ built_at: fresh.built_at }, { now: NOW, catalog: { travel: 1, quest: 1 } })
    expect(report.ok).toBe(false)
    expect(report.problems).toEqual(['в слепке нет числа источников: пересоберите его текущим сборщиком'])
  })

  it('лишние источники в слепке (материал снят с публикации) — тоже расхождение', () => {
    const report = checkFreshness({ built_at: fresh.built_at, sources: { travel: 100, quest: 10 } }, { now: NOW, catalog: { travel: 90, quest: 10 } })
    expect(report.problems).toEqual(['статей в слепке 100, в каталоге 90 — расхождение 11.1 % при пороге 2.0 %'])
  })
})

describe('ai-index: что проверяется на свежесть', () => {
  it('индекс: числа из манифеста; у артефакта до #3288 — по фрагментам', () => {
    const distDir = makeTempDir('ai-index-fresh-')
    writeIndex(distDir, { model: 'm', dim: 2, chunks: CHUNKS, vectors: CHUNKS.map(() => [1, 0]), builtAt: '2026-11-10T00:00:00.000Z' })
    expect(readFreshnessSubject({ distDir })).toEqual({ built_at: '2026-11-10T00:00:00.000Z', sources: { travel: 2, quest: 2 } })

    const manifestFile = path.join(distDir, MANIFEST_FILE)
    const { sources: _sources, ...legacy } = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    fs.writeFileSync(manifestFile, JSON.stringify(legacy))
    expect(readFreshnessSubject({ distDir })).toEqual({ built_at: '2026-11-10T00:00:00.000Z', sources: { travel: 2, quest: 2 } })
  })

  it('производный файл: index_built_at и sources; нет файла или каталога — ошибка с подсказкой', () => {
    const dir = makeTempDir('ai-similar-fresh-')
    const file = path.join(dir, 'ai-similar.json')
    fs.writeFileSync(file, JSON.stringify({ version: 1, index_built_at: '2026-11-11T00:00:00.000Z', sources: { travel: 3, quest: 2 } }))
    expect(readFreshnessSubject({ artifactFile: file, distDir: dir })).toEqual({ built_at: '2026-11-11T00:00:00.000Z', sources: { travel: 3, quest: 2 } })
    fs.writeFileSync(file, JSON.stringify({ version: 1 }))
    expect(readFreshnessSubject({ artifactFile: file, distDir: dir })).toEqual({ built_at: '', sources: null })
    expect(() => readFreshnessSubject({ artifactFile: path.join(dir, 'missing.json'), distDir: dir })).toThrow('нет файла')
    expect(() => readFreshnessSubject({ distDir: dir })).toThrow('npm run ai:index -- build')
  })
})

describe('ai-index: число источников каталога', () => {
  it('идёт только по спискам: опубликованные статьи и все квесты, по страницам', async () => {
    const calls: string[] = []
    const fetcher: Fetcher = async (url) => {
      calls.push(url.replace('https://api.test', ''))
      const page = Number(new URL(url).searchParams.get('page'))
      if (url.includes('/travels/')) {
        return page === 1
          ? { next: 'yes', results: [{ id: 1, publish: true, moderation: true }, { id: 2, publish: true, moderation: false }] }
          : { next: null, results: [{ id: 3, publish: true, moderation: true }, { id: 4, publish: false, moderation: true }] }
      }
      return page === 1 ? { next: 'yes', results: [{ id: 10 }, { id: 11 }] } : { next: null, results: [{ id: 12 }] }
    }
    await expect(countCatalogSources({ apiBase: 'https://api.test', fetcher })).resolves.toEqual({ travel: 2, quest: 3 })
    expect(calls).toEqual(['/travels/?page_size=50&page=1', '/travels/?page_size=50&page=2', '/quests/?page=1', '/quests/?page=2'])
  })
})
