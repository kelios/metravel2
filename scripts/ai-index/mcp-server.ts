/**
 * MCP-сервер `metravel-knowledge` (#2455): четыре инструмента поверх `Knowledge`. Фабрика без
 * транспорта — тест подключает её через InMemoryTransport, `mcp.ts` — через stdio.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { DEFAULT_LIMIT, type Knowledge, MAX_LIMIT } from './knowledge.ts'

export const SERVER_NAME = 'metravel-knowledge'
export const SERVER_VERSION = '1.0.0'

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .optional()
  .describe(`Сколько источников вернуть (по умолчанию ${DEFAULT_LIMIT}, максимум ${MAX_LIMIT}).`)

const typeSchema = z.enum(['travel', 'quest'])

const itemSchema = z.object({
  score: z.number(),
  type: typeSchema,
  source_id: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
})

const coverageSourceSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  mentions: z.number(),
  in_title: z.boolean(),
})

const reply = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  structuredContent: payload as Record<string, unknown>,
})

const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })

export function createKnowledgeServer(knowledge: Knowledge, indexInfo: { model: string; count: number; builtAt: string }): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })

  server.registerTool(
    'search',
    {
      title: 'Поиск материалов сайта по смыслу',
      description:
        'Семантический поиск по статьям и квестам metravel.by (индекс #2454). Запрос — на любом из RU/BE/UK/PL/EN. ' +
        'Возвращает лучшие источники (статья или квест один раз) со сниппетом фрагмента, URL и городом. ' +
        `Индекс: модель ${indexInfo.model}, ${indexInfo.count} фрагментов, собран ${indexInfo.builtAt}.`,
      inputSchema: {
        query: z.string().min(1).describe('Вопрос или тема, например «замки под Краковом на один день».'),
        limit: limitSchema,
        type: typeSchema.optional().describe('Только статьи (travel) или только квесты (quest).'),
        country: z.string().optional().describe('Страна источника как в карточке (Польша / Беларусь …), без учёта регистра.'),
      },
      outputSchema: { items: z.array(itemSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit, type, country }) => reply({ items: await knowledge.search({ query, limit, type, country }) }),
  )

  server.registerTool(
    'similar',
    {
      title: 'Похожие материалы',
      description:
        'Статьи и квесты, близкие по смыслу к данному источнику (вектор источника — среднее его фрагментов); сам источник исключён.',
      inputSchema: {
        type: typeSchema.describe('Тип источника.'),
        source_id: z.number().int().positive().describe('id статьи (travel) или quest_id квеста.'),
        limit: limitSchema,
      },
      outputSchema: { items: z.array(itemSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ type, source_id, limit }) => {
      const items = knowledge.similar({ type, source_id, limit })
      if (!items) return failure(`источник ${type}:${source_id} отсутствует в индексе (не опубликован или индекс собран раньше)`)
      return reply({ items })
    },
  )

  server.registerTool(
    'coverage',
    {
      title: 'Что уже написано про место',
      description:
        'Лексический поиск упоминаний места в заголовках, городах и текстах: статьи и квесты с числом фрагментов, где место названо. ' +
        'Склонения учитываются по основам слов (stems в ответе). Для «про что ещё нет статьи» см. gaps.',
      inputSchema: { place: z.string().min(1).describe('Место: город, парк, озеро — «Беловежская пуща», «Ойцув».') },
      outputSchema: {
        place: z.string(),
        stems: z.array(z.string()),
        travels: z.array(coverageSourceSchema),
        quests: z.array(coverageSourceSchema),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ place }) => reply(knowledge.coverage(place)),
  )

  server.registerTool(
    'gaps',
    {
      title: 'Места страны без своей статьи',
      description:
        'Города страны из квестов и статей, у которых нет собственной статьи (ни по городу, ни по заголовку, ни по точке в радиусе 10 км). ' +
        'Для каждого — квесты этого места и число статей, где оно лишь упоминается.',
      inputSchema: { country: z.string().min(1).describe('Страна как в карточках: Польша, Беларусь, Литва …') },
      outputSchema: {
        country: z.string(),
        sources: z.object({ travels: z.number(), quests: z.number() }),
        gaps: z.array(
          z.object({
            place: z.string(),
            quests: z.array(z.object({ id: z.number(), title: z.string(), url: z.string() })),
            mentioned_in: z.number(),
          }),
        ),
        covered: z.array(z.object({ place: z.string(), travels: z.number() })),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ country }) => reply(knowledge.gaps(country)),
  )

  return server
}
