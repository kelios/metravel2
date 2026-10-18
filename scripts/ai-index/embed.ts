/**
 * Эмбеддинги фрагментов через transformers.js (ONNX, int8). Инкремент: вектор фрагмента
 * с тем же id берётся из предыдущего артефакта той же модели, считаются только новые.
 */
import os from 'node:os'
import { type ChunkRecord, type IndexArtifact, readIndex, writeIndex } from './format.ts'
import { defaultModelCacheDir, type EmbeddingModelSpec } from './models.ts'

export interface EmbeddingPlan {
  reuse: Map<string, Float32Array>
  compute: ChunkRecord[]
}

/** Чистая функция инкремента: какие векторы переиспользовать, какие считать заново. */
export function planEmbedding(chunks: ChunkRecord[], previous: IndexArtifact | null, modelKey: string): EmbeddingPlan {
  const reuse = new Map<string, Float32Array>()
  const compute: ChunkRecord[] = []
  const previousIndex = new Map<string, number>()
  if (previous && previous.manifest.model === modelKey) {
    previous.chunks.forEach((chunk, index) => previousIndex.set(chunk.id, index))
  }
  for (const chunk of chunks) {
    const index = previousIndex.get(chunk.id)
    // id зависит только от текста, а документ модели — ещё и от заголовка: новый заголовок → пересчёт.
    if (index === undefined || !previous || previous.chunks[index].title !== chunk.title) {
      compute.push(chunk)
      continue
    }
    const { dim } = previous.manifest
    reuse.set(chunk.id, previous.vectors.subarray(index * dim, (index + 1) * dim))
  }
  return { reuse, compute }
}

export interface Embedder {
  spec: EmbeddingModelSpec
  embedDocuments: (chunks: Array<{ title: string; text: string }>) => Promise<Float32Array[]>
  embedQuery: (query: string) => Promise<Float32Array>
  dispose: () => Promise<void>
}

export interface EmbedderOptions {
  threads?: number
  cacheDir?: string
  batchSize?: number
}

interface OutputTensor {
  dims: number[]
  data: Float32Array
  normalize: (p: number, dim: number) => OutputTensor
  dispose?: () => void
}

type Runner = {
  run: (texts: string[]) => Promise<OutputTensor>
  dispose: () => Promise<void>
}

export async function createEmbedder(spec: EmbeddingModelSpec, options: EmbedderOptions = {}): Promise<Embedder> {
  const transformers = await import('@huggingface/transformers')
  transformers.env.cacheDir = options.cacheDir ?? defaultModelCacheDir()
  transformers.env.allowLocalModels = false
  const threads = options.threads ?? Math.max(1, os.availableParallelism() - 1)
  const session_options = { intraOpNumThreads: threads, interOpNumThreads: 1 }

  let runner: Runner
  if (spec.recipe === 'sentence_embedding') {
    // Штатный выход графа (пулинг + dense-слои + L2 внутри модели), как в карточке модели.
    const tokenizer = await transformers.AutoTokenizer.from_pretrained(spec.hfId)
    const model = await transformers.AutoModel.from_pretrained(spec.hfId, { dtype: spec.dtype, session_options })
    runner = {
      async run(texts) {
        const inputs = await tokenizer(texts, { padding: true, truncation: true })
        const outputs = (await model(inputs)) as Record<string, OutputTensor | undefined>
        const embedding = outputs.sentence_embedding
        if (!embedding) throw new Error(`model ${spec.key} has no sentence_embedding output`)
        return embedding.normalize(2, -1)
      },
      async dispose() {
        await model.dispose?.()
      },
    }
  } else {
    const extractor = (await transformers.pipeline('feature-extraction', spec.hfId, {
      dtype: spec.dtype,
      session_options,
    })) as unknown as ((texts: string[], options: { pooling: typeof spec.pooling; normalize: boolean }) => Promise<OutputTensor>) & {
      dispose?: () => Promise<void>
    }
    runner = {
      run: (texts) => extractor(texts, { pooling: spec.pooling, normalize: true }),
      async dispose() {
        await extractor.dispose?.()
      },
    }
  }
  const batchSize = options.batchSize ?? 16

  const run = async (texts: string[]): Promise<Float32Array[]> => {
    const output = await runner.run(texts)
    const [rows, dim] = output.dims
    if (dim !== spec.dim) throw new Error(`model ${spec.key} returned dim ${dim}, expected ${spec.dim}`)
    const vectors: Float32Array[] = []
    for (let i = 0; i < rows; i += 1) vectors.push(Float32Array.from(output.data.subarray(i * dim, (i + 1) * dim)))
    output.dispose?.()
    return vectors
  }

  return {
    spec,
    async embedDocuments(chunks) {
      const vectors: Float32Array[] = []
      for (let start = 0; start < chunks.length; start += batchSize) {
        const batch = chunks.slice(start, start + batchSize).map((chunk) => spec.formatDocument(chunk))
        vectors.push(...(await run(batch)))
      }
      return vectors
    },
    async embedQuery(query) {
      const [vector] = await run([spec.formatQuery(query)])
      return vector
    },
    async dispose() {
      await runner.dispose()
    },
  }
}

export interface EmbedRunOptions {
  chunks: ChunkRecord[]
  distDir: string
  embedder: Embedder
  full?: boolean
  log?: (line: string) => void
}

export interface EmbedRunSummary {
  computed: number
  reused: number
  count: number
  seconds: number
}

export async function runEmbed(options: EmbedRunOptions): Promise<EmbedRunSummary> {
  const log = options.log ?? ((line: string) => console.error(line))
  const started = Date.now()
  const { spec } = options.embedder
  let previous: IndexArtifact | null = null
  if (!options.full) {
    try {
      previous = readIndex(options.distDir)
    } catch (error) {
      log(`предыдущий артефакт не читается, полный пересчёт: ${String(error)}`)
    }
  }
  const plan = planEmbedding(options.chunks, previous, spec.key)
  log(`embed(${spec.key}): фрагментов ${options.chunks.length}, переиспользовано ${plan.reuse.size}, считать ${plan.compute.length}`)
  const computed = new Map<string, Float32Array>()
  const step = 256
  for (let start = 0; start < plan.compute.length; start += step) {
    const slice = plan.compute.slice(start, start + step)
    const vectors = await options.embedder.embedDocuments(slice)
    slice.forEach((chunk, i) => computed.set(chunk.id, vectors[i]))
    log(`embed: ${Math.min(start + step, plan.compute.length)}/${plan.compute.length}`)
  }
  const vectors = options.chunks.map((chunk) => {
    const vector = computed.get(chunk.id) ?? plan.reuse.get(chunk.id)
    if (!vector) throw new Error(`no vector for chunk ${chunk.id}`)
    return vector
  })
  writeIndex(options.distDir, { model: spec.key, dim: spec.dim, chunks: options.chunks, vectors })
  const seconds = (Date.now() - started) / 1000
  log(`пересчитано ${plan.compute.length} фрагментов, переиспользовано ${plan.reuse.size}, итого ${options.chunks.length} за ${seconds.toFixed(1)} с`)
  return { computed: plan.compute.length, reused: plan.reuse.size, count: options.chunks.length, seconds }
}
