/**
 * Реестр моделей эмбеддингов индекса. Модель индексации и модель запроса обязаны совпадать
 * (включая квантование): manifest.model хранит ключ из этого реестра.
 */
import os from 'node:os'
import path from 'node:path'

export type PoolingKind = 'mean' | 'last_token'

/**
 * Рецепт вектора — часть контракта индекса (сервис #2456 и MCP #2455 обязаны считать
 * запрос тем же способом):
 *  - `sentence_embedding` — штатный выход ONNX-графа модели (у EmbeddingGemma: mean pooling
 *    по маске → Dense 768→3072 → Dense 3072→768 → L2); берётся через AutoTokenizer + AutoModel,
 *    как в карточке модели; `pooling` при этом не используется;
 *  - `pooled` — `last_hidden_state`, свёрнутый по `pooling` (mean по маске или последний
 *    токен) и нормализованный L2 — pipeline `feature-extraction` из transformers.js.
 */
export type VectorRecipe = 'sentence_embedding' | 'pooled'

export interface EmbeddingModelSpec {
  key: string
  hfId: string
  dim: number
  /** dtype transformers.js: q8 = onnx/model_quantized.onnx (int8 веса). */
  dtype: 'q8' | 'fp32' | 'fp16' | 'q4'
  recipe: VectorRecipe
  /** Пулинг для рецепта `pooled`; для `sentence_embedding` только документирует граф. */
  pooling: PoolingKind
  formatDocument: (chunk: { title: string; text: string }) => string
  formatQuery: (query: string) => string
}

export const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec> = {
  'embeddinggemma-300m': {
    key: 'embeddinggemma-300m',
    hfId: 'onnx-community/embeddinggemma-300m-ONNX',
    dim: 768,
    dtype: 'q8',
    recipe: 'sentence_embedding',
    pooling: 'mean',
    formatDocument: ({ title, text }) => `title: ${title || 'none'} | text: ${text}`,
    formatQuery: (query) => `task: search result | query: ${query}`,
  },
  'qwen3-embedding-0.6b': {
    key: 'qwen3-embedding-0.6b',
    hfId: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
    dim: 1024,
    dtype: 'q8',
    recipe: 'pooled',
    pooling: 'last_token',
    formatDocument: ({ title, text }) => (title ? `${title}\n${text}` : text),
    formatQuery: (query) =>
      `Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:${query}`,
  },
}

export const DEFAULT_MODEL_KEY = 'embeddinggemma-300m'

export function resolveModel(key: string | undefined): EmbeddingModelSpec {
  const spec = EMBEDDING_MODELS[key ?? DEFAULT_MODEL_KEY]
  if (!spec) {
    throw new Error(`unknown embedding model "${key}"; known: ${Object.keys(EMBEDDING_MODELS).join(', ')}`)
  }
  return spec
}

/** Кэш весов вне node_modules, чтобы переустановка зависимостей не тянула модели заново. */
export function defaultModelCacheDir(): string {
  return process.env.AI_INDEX_MODEL_CACHE || path.join(os.homedir(), 'metravel-ai', 'models', 'transformers-cache')
}
