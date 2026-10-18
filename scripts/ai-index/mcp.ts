/**
 * Точка входа MCP `metravel-knowledge` (stdio), регистрируется в `.mcp.json`.
 *
 *   METRAVEL_AI_INDEX_DIR    — каталог артефакта (по умолчанию .codex-temp/ai-index/dist от cwd);
 *   METRAVEL_AI_INDEX_MODEL  — строгий ключ модели: несовпадение с manifest.model — отказ старта;
 *                              без переменной модель берётся из манифеста (обязана быть в реестре);
 *   AI_INDEX_THREADS         — потоки ONNX для эмбеддинга запроса (по умолчанию ядра − 1);
 *   AI_INDEX_MODEL_CACHE     — кэш весов (см. models.ts).
 *
 * Индекс и модель проверяются до открытия транспорта: ошибка → строка в stderr и код 1.
 * Веса модели грузятся лениво при первом `search` (similar/coverage/gaps модели не требуют).
 */
import path from 'node:path'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createEmbedder, type Embedder } from './embed.ts'
import { createKnowledge, DEFAULT_INDEX_DIR, openKnowledgeIndex } from './knowledge.ts'
import { createKnowledgeServer, SERVER_NAME } from './mcp-server.ts'
import { resolveModel } from './models.ts'

const log = (line: string) => console.error(`[${SERVER_NAME}] ${line}`)

async function main(): Promise<void> {
  const distDir = path.resolve(process.env.METRAVEL_AI_INDEX_DIR || DEFAULT_INDEX_DIR)
  const expectedModel = process.env.METRAVEL_AI_INDEX_MODEL || undefined
  const index = openKnowledgeIndex(distDir, { expectedModel })
  const spec = resolveModel(index.artifact.manifest.model)
  log(`индекс ${distDir}: ${index.artifact.manifest.count} фрагментов, ${index.rowsBySource.size} источников, модель ${spec.key}`)

  const threadsEnv = Number(process.env.AI_INDEX_THREADS)
  let embedderPromise: Promise<Embedder> | null = null
  const embedQuery = async (query: string) => {
    if (!embedderPromise) {
      const started = Date.now()
      embedderPromise = createEmbedder(spec, { threads: Number.isFinite(threadsEnv) && threadsEnv > 0 ? threadsEnv : undefined }).then(
        (embedder) => {
          log(`модель ${spec.key} загружена за ${Date.now() - started} мс`)
          return embedder
        },
        (error) => {
          embedderPromise = null
          throw error
        },
      )
    }
    return (await embedderPromise).embedQuery(query)
  }

  const knowledge = createKnowledge(index, embedQuery)
  const server = createKnowledgeServer(knowledge, {
    model: spec.key,
    count: index.artifact.manifest.count,
    builtAt: index.artifact.manifest.built_at,
  })
  await server.connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
