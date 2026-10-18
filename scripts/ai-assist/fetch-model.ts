/**
 * Скачивает веса модели эмбеддингов в кэш и проверяет их одним запросом. Шаг сборки образа
 * (`services/ai-assist/Dockerfile`): прод в интернет не ходит, модель запекается в образ.
 *   AI_ASSIST_MODEL_CACHE=/models/transformers-cache node --experimental-strip-types scripts/ai-assist/fetch-model.ts
 */
import { createEmbedder } from '../ai-index/embed.ts'
import { DEFAULT_MODEL_KEY, defaultModelCacheDir, resolveModel } from '../ai-index/models.ts'

async function main(): Promise<void> {
  const spec = resolveModel(process.env.AI_ASSIST_MODEL || DEFAULT_MODEL_KEY)
  const cacheDir = process.env.AI_ASSIST_MODEL_CACHE || defaultModelCacheDir()
  const embedder = await createEmbedder(spec, { threads: 1, cacheDir })
  const vector = await embedder.embedQuery('проверка модели')
  await embedder.dispose()
  if (vector.length !== spec.dim) throw new Error(`модель вернула dim ${vector.length}, ожидалось ${spec.dim}`)
  console.log(JSON.stringify({ model: spec.key, hfId: spec.hfId, dtype: spec.dtype, dim: vector.length, cacheDir }))
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exit(1)
})
