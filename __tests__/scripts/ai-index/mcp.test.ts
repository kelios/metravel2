/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { chunkId, type ChunkRecord, MANIFEST_FILE, writeIndex } from '@/scripts/ai-index/format'
import {
  createKnowledge,
  type KnowledgeIndex,
  KnowledgeModelMismatch,
  normalizeText,
  openKnowledgeIndex,
  placeStems,
} from '@/scripts/ai-index/knowledge'
import { createKnowledgeServer } from '@/scripts/ai-index/mcp-server'

import { DIM, fakeEmbedQuery, fakeVector, MODEL, writeFixtureIndex } from '../ai-assist/fixture'
import { makeTempDir } from '../cli-test-utils'

const openFixture = (model = MODEL): KnowledgeIndex => openKnowledgeIndex(writeFixtureIndex(model), { expectedModel: model })

describe('metravel-knowledge: открытие индекса', () => {
  it('читает артефакт, сохраняет тексты фрагментов и страны источников', () => {
    const index = openFixture()
    expect(index.artifact.manifest.count).toBe(7)
    expect(index.normalizedTexts[2]).toContain(normalizeText('Ойцув'))
    expect(index.artifact.chunks[2].text).toBe('')
    expect(index.countriesBySource.get('quest:1')).toEqual(new Set(['польша']))
  })

  it('без METRAVEL_AI_INDEX_MODEL модель манифеста обязана быть в реестре', () => {
    expect(() => openKnowledgeIndex(writeFixtureIndex('embeddinggemma-300m'))).not.toThrow()
    expect(() => openKnowledgeIndex(writeFixtureIndex('fake-model'))).toThrow(KnowledgeModelMismatch)
    expect(() => openKnowledgeIndex(writeFixtureIndex('fake-model'))).toThrow(
      /индекс собран моделью "fake-model", сервер ожидает "embeddinggemma-300m \| embeddinggemma-300m-q4 \| qwen3-embedding-0\.6b"/,
    )
  })

  it('строгий ключ модели: подменённый manifest.model — отказ с именами обеих моделей', () => {
    const distDir = writeFixtureIndex('embeddinggemma-300m')
    const manifestFile = path.join(distDir, MANIFEST_FILE)
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, model: 'qwen3-embedding-0.6b' }))
    expect(() => openKnowledgeIndex(distDir, { expectedModel: 'embeddinggemma-300m' })).toThrow(
      /индекс собран моделью "qwen3-embedding-0\.6b", сервер ожидает "embeddinggemma-300m"/,
    )
  })

  it('пустая директория — понятная ошибка с подсказкой про METRAVEL_AI_INDEX_DIR', () => {
    expect(() => openKnowledgeIndex(makeTempDir('ai-knowledge-empty-'))).toThrow(/нет артефакта индекса.*METRAVEL_AI_INDEX_DIR/)
  })
})

describe('metravel-knowledge: нормализация', () => {
  it('normalizeText снимает регистр, ё и латинскую диакритику, кириллицу не трогает', () => {
    expect(normalizeText('  Kraków — Ёлка!  ')).toBe('krakow елка')
    expect(normalizeText('Ойцув, Мінск і Київ')).toBe('ойцув мінск і київ')
  })

  it('placeStems режет окончания по длине слова', () => {
    expect(placeStems('Беловежская пуща')).toEqual(['беловежс', 'пущ'])
    expect(placeStems('Краков')).toEqual(['крак'])
    expect(placeStems('Ойцув')).toEqual(['ойцу'])
    expect(placeStems('Zamki pod Krakowem')).toEqual(['zamk', 'pod', 'krakow'])
  })
})

describe('metravel-knowledge: инструменты на фикстурном индексе', () => {
  const knowledge = createKnowledge(openFixture(), fakeEmbedQuery)

  it('search: источник один раз, со сниппетом и URL; фильтр типа и лимит', async () => {
    const items = await knowledge.search({ query: 'рождественские ярмарки краков вроцлав гданьск' })
    expect(items[0]).toMatchObject({ type: 'travel', source_id: 816, title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', city: 'Краков' })
    expect(items[0].snippet).toContain('ярмарки')
    expect(new Set(items.map((item) => `${item.type}:${item.source_id}`)).size).toBe(items.length)
    expect(items.map((item) => item.score)).toEqual([...items.map((item) => item.score)].sort((a, b) => b - a))

    const quests = await knowledge.search({ query: 'квест гродно замок', type: 'quest', limit: 1 })
    expect(quests).toHaveLength(1)
    expect(quests[0]).toMatchObject({ type: 'quest', source_id: 1, title: 'Квест по Гродно' })
  })

  it('search: фильтр страны без учёта регистра, пустой запрос — пустой список', async () => {
    expect(await knowledge.search({ query: 'краков', country: 'польша' })).not.toHaveLength(0)
    expect(await knowledge.search({ query: 'краков', country: 'Литва' })).toEqual([])
    expect(await knowledge.search({ query: '   ' })).toEqual([])
  })

  it('similar: исключает сам источник; неизвестный источник — null', () => {
    const items = knowledge.similar({ type: 'travel', source_id: 816 })!
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((item) => item.type === 'travel' && item.source_id === 816)).toBe(false)
    expect(knowledge.similar({ type: 'travel', source_id: 999 })).toBeNull()
  })

  it('coverage: статьи и квесты с упоминаниями, заголовок/город впереди', () => {
    const pushcha = knowledge.coverage('Беловежской пуще')
    expect(pushcha.travels).toEqual([
      expect.objectContaining({ id: 791, title: 'Беловежская пуща', mentions: 1, in_title: true }),
    ])
    expect(pushcha.quests).toEqual([])

    const krakow = knowledge.coverage('Кракове')
    expect(krakow.travels.map((t) => [t.id, t.mentions, t.in_title])).toEqual([
      [816, 2, true],
      [761, 1, false],
    ])
    expect(knowledge.coverage('').travels).toEqual([])
  })

  it('gaps: страна без учёта регистра; у фикстуры все точки в одном месте — всё covered по радиусу', () => {
    const result = knowledge.gaps('ПОЛЬША')
    expect(result.sources).toEqual({ travels: 3, quests: 2 })
    expect(result.gaps).toEqual([])
    expect(result.covered.map((c) => c.place).sort()).toEqual(['Брест', 'Гродно', 'Каменюки', 'Краков', 'Ойцув'])
    expect(knowledge.gaps('Литва')).toMatchObject({ sources: { travels: 0, quests: 0 }, gaps: [], covered: [] })
  })

  it('gaps: статья закрывает город квеста по заголовку или по точке в 10 км', () => {
    const specs: Array<Partial<ChunkRecord> & { type: ChunkRecord['type']; source_id: number; title: string; text: string }> = [
      { type: 'quest', source_id: 1, title: 'Квест по Гродно', text: 'квест гродно', city: 'Гродно', lat: 53.68, lng: 23.83 },
      { type: 'quest', source_id: 2, title: 'Квест по Лиде', text: 'квест лида', city: 'Лида', lat: 53.89, lng: 25.3 },
      { type: 'quest', source_id: 3, title: 'Квест по Бресту', text: 'квест брест', city: 'Брест', lat: 52.1, lng: 23.7 },
      { type: 'travel', source_id: 10, title: 'Выходные в Гродно', text: 'старый замок', city: null, lat: null, lng: null },
      { type: 'travel', source_id: 11, title: 'Замок у озера', text: 'лидский замок и брест по пути', city: null, lat: 53.885, lng: 25.31 },
    ]
    const chunks: ChunkRecord[] = specs.map((spec) => ({
      id: chunkId(spec.type, spec.source_id, 'ru', spec.text),
      type: spec.type,
      source_id: spec.source_id,
      url: `https://metravel.by/${spec.type}/${spec.source_id}`,
      title: spec.title,
      city: spec.city ?? null,
      country: 'Беларусь',
      lat: spec.lat ?? null,
      lng: spec.lng ?? null,
      month: [],
      tags: [],
      locale: 'ru',
      text: spec.text,
    }))
    const distDir = makeTempDir('ai-knowledge-gaps-')
    writeIndex(distDir, { model: 'embeddinggemma-300m', dim: DIM, chunks, vectors: chunks.map((c) => fakeVector(c.text)) })
    const result = createKnowledge(openKnowledgeIndex(distDir), fakeEmbedQuery).gaps('Беларусь')
    expect(result.covered.map((c) => c.place).sort()).toEqual(['Гродно', 'Лида'])
    expect(result.gaps).toEqual([{ place: 'Брест', quests: [{ id: 3, title: 'Квест по Бресту', url: 'https://metravel.by/quest/3' }], mentioned_in: 1 }])
  })
})

describe('metravel-knowledge: контракт MCP', () => {
  it('четыре инструмента, structuredContent по схеме, ошибка similar — isError', async () => {
    const index = openFixture()
    const server = createKnowledgeServer(createKnowledge(index, fakeEmbedQuery), { model: MODEL, count: 7, builtAt: '2026-10-18' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    const client = new Client({ name: 'test', version: '0' })
    await client.connect(clientTransport)

    const tools = await client.listTools()
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(['coverage', 'gaps', 'search', 'similar'])
    expect(tools.tools.find((tool) => tool.name === 'search')?.description).toContain(MODEL)

    const search = await client.callTool({ name: 'search', arguments: { query: 'рождественские ярмарки краков вроцлав гданьск', limit: 2 } })
    const items = (search.structuredContent as { items: Array<{ source_id: number }> }).items
    expect(items).toHaveLength(2)
    expect(items[0].source_id).toBe(816)
    expect(JSON.parse((search.content as Array<{ text: string }>)[0].text).items[0].source_id).toBe(816)

    const coverage = await client.callTool({ name: 'coverage', arguments: { place: 'Гродно' } })
    expect((coverage.structuredContent as { quests: unknown[] }).quests).toHaveLength(1)

    const gaps = await client.callTool({ name: 'gaps', arguments: { country: 'Польша' } })
    expect((gaps.structuredContent as { covered: unknown[] }).covered).toHaveLength(5)

    const missing = await client.callTool({ name: 'similar', arguments: { type: 'quest', source_id: 42 } })
    expect(missing.isError).toBe(true)

    const tooBig = await client.callTool({ name: 'search', arguments: { query: 'x', limit: 500 } })
    expect(tooBig.isError).toBe(true)
    expect((tooBig.content as Array<{ text: string }>)[0].text).toMatch(/<=50/)

    await client.close()
    await server.close()
  })
})
