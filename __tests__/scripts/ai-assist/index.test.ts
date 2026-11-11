import fs from 'fs'
import path from 'path'

import { IndexModelMismatch, loadIndex } from '@/scripts/ai-assist/index'
import { FACTS_FILE, MANIFEST_FILE, type SourceFacts } from '@/scripts/ai-index/format'

import { makeTempDir } from '../cli-test-utils'
import { FIXTURE_CHUNKS, MODEL, writeFixtureIndex } from './fixture'

describe('metravel-assist: загрузка индекса', () => {
  it('читает согласованный артефакт и строит карты источников', async () => {
    const index = await loadIndex(writeFixtureIndex(), { expectedModel: MODEL })
    expect(index.artifact.manifest.count).toBe(7)
    expect([...index.rowsBySource.keys()].sort()).toEqual(['quest:1', 'quest:2', 'travel:761', 'travel:791', 'travel:816'])
    expect(index.rowsBySource.get('travel:816')).toEqual([0, 1])
    expect([...index.localesBySource.get('quest:1')!].sort()).toEqual(['pl', 'ru'])
    expect(Array.from(index.typeOfRow)).toEqual([0, 0, 0, 0, 1, 1, 1])
  })

  it('чужая модель — отказ без повторов с именами обеих моделей', async () => {
    const distDir = writeFixtureIndex('qwen3-embedding-0.6b')
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 3, retryDelayMs: 1 })).rejects.toThrow(IndexModelMismatch)
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 1 })).rejects.toThrow(/qwen3-embedding-0\.6b.*fake-model/)
  })

  it('несогласованный набор файлов отбрасывается, но повтор видит починенный артефакт', async () => {
    const distDir = writeFixtureIndex()
    const manifestFile = path.join(distDir, MANIFEST_FILE)
    const good = fs.readFileSync(manifestFile, 'utf8')
    const broken = JSON.stringify({ ...JSON.parse(good), source_sha256: '0'.repeat(64) })
    fs.writeFileSync(manifestFile, broken)
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 2, retryDelayMs: 1 })).rejects.toThrow(/source_sha256/)

    fs.writeFileSync(manifestFile, broken)
    setTimeout(() => fs.writeFileSync(manifestFile, good), 20)
    const index = await loadIndex(distDir, { expectedModel: MODEL, attempts: 5, retryDelayMs: 15 })
    expect(index.artifact.manifest.count).toBe(7)
  })

  // #3287: факты источника — файл артефакта рядом с фрагментами.
  const FACTS: SourceFacts[] = [
    { type: 'travel', source_id: 816, number_days: 3, months: [11, 12] },
    { type: 'quest', source_id: 1, points: 9, duration_min: 90, difficulty: 'easy' },
  ]

  it('#3287: факты артефакта доступны по ключу источника', async () => {
    const index = await loadIndex(writeFixtureIndex(MODEL, FIXTURE_CHUNKS, FACTS), { expectedModel: MODEL })
    expect(index.artifact.manifest.format_version).toBe(2)
    expect([...index.factsBySource.keys()].sort()).toEqual(['quest:1', 'travel:816'])
    expect(index.factsBySource.get('quest:1')).toEqual(FACTS[1])
  })

  it('#3287: артефакт прежнего формата (без версии и facts.jsonl) загружается, фактов нет', async () => {
    const distDir = writeFixtureIndex(MODEL, FIXTURE_CHUNKS, FACTS)
    const manifestFile = path.join(distDir, MANIFEST_FILE)
    const { format_version: _version, facts: _facts, ...legacy } = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    fs.writeFileSync(manifestFile, JSON.stringify(legacy))
    fs.rmSync(path.join(distDir, FACTS_FILE))
    const index = await loadIndex(distDir, { expectedModel: MODEL, attempts: 1 })
    expect(index.artifact.manifest.count).toBe(7)
    expect(index.factsBySource.size).toBe(0)
  })

  it('#3287: читатель попал между заменой facts.jsonl и манифеста — повтор видит согласованный артефакт', async () => {
    const distDir = writeFixtureIndex(MODEL, FIXTURE_CHUNKS, FACTS)
    const factsFile = path.join(distDir, FACTS_FILE)
    const good = fs.readFileSync(factsFile, 'utf8')
    fs.writeFileSync(factsFile, `${JSON.stringify({ type: 'travel', source_id: 816, number_days: 9 })}\n`)
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 2, retryDelayMs: 1 })).rejects.toThrow(/facts\.jsonl/)
    setTimeout(() => fs.writeFileSync(factsFile, good), 20)
    const index = await loadIndex(distDir, { expectedModel: MODEL, attempts: 5, retryDelayMs: 15 })
    expect(index.factsBySource.size).toBe(2)
  })

  it('#3290: полный текст фрагмента читается с диска по номеру строки; в памяти остаётся только сниппет', async () => {
    const distDir = writeFixtureIndex()
    const index = await loadIndex(distDir, { expectedModel: MODEL })
    expect(index.artifact.chunks[0].text).toBe('')
    expect(index.readText?.(0)).toBe(FIXTURE_CHUNKS[0].text)
    expect(index.readText?.(6)).toBe(FIXTURE_CHUNKS[6].text)
    expect(index.readText?.(7)).toBeNull()
    expect(index.readText?.(-1)).toBeNull()

    // Пересборка заменяет файл через rename: открытый описатель продолжает читать прежний индекс.
    const chunksFile = path.join(distDir, 'chunks.jsonl')
    const original = fs.readFileSync(chunksFile, 'utf8')
    fs.writeFileSync(`${chunksFile}.new`, original.replace(/рождественские/g, 'ПЕРЕСОБРАННЫЕ'))
    fs.renameSync(`${chunksFile}.new`, chunksFile)
    expect(index.readText?.(0)).toBe(FIXTURE_CHUNKS[0].text)

    // Файл изменили на месте — запись не та, чтение отдаёт null, и режим страницы берёт сниппет из памяти.
    const inPlace = writeFixtureIndex()
    const other = await loadIndex(inPlace, { expectedModel: MODEL })
    const file = path.join(inPlace, 'chunks.jsonl')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').reverse().join('\n'))
    expect(other.readText?.(0)).toBeNull()
  })

  it('пустая директория — понятная ошибка', async () => {
    const distDir = makeTempDir('ai-assist-empty-')
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 1 })).rejects.toThrow(/нет артефакта/)
  })
})
