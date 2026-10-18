import fs from 'fs'
import path from 'path'

import { IndexModelMismatch, loadIndex } from '@/scripts/ai-assist/index'
import { MANIFEST_FILE } from '@/scripts/ai-index/format'

import { MODEL, writeFixtureIndex } from './fixture'

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

  it('пустая директория — понятная ошибка', async () => {
    const distDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ai-assist-empty-'))
    await expect(loadIndex(distDir, { expectedModel: MODEL, attempts: 1 })).rejects.toThrow(/нет артефакта/)
  })
})
