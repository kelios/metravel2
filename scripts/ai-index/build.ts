#!/usr/bin/env node --experimental-strip-types
/**
 * Смысловой индекс контента сайта (#2454). Запуск: `npm run ai:index -- <команда> [опции]`.
 *
 *   export   — скачать статьи и квесты из прод-API в <out>/raw (инкремент по updated_at)
 *   chunk    — raw → <out>/work/chunks.jsonl (нарезка ~800 символов, перекрытие 100)
 *   embed    — work/chunks.jsonl → <dist>/{chunks.jsonl,vectors.f16,manifest.json}, инкремент по id
 *   manifest — проверить артефакт (count, размер vectors.f16, source_sha256) и напечатать manifest
 *   query    — "<вопрос>": top-k фрагментов из артефакта
 *   eval     — --queries <jsonl>: recall@5 и латентность запроса на наборе вопросов
 *   build    — export + chunk + embed + manifest одной командой
 *
 * Опции: --out <dir> (по умолчанию .codex-temp/ai-index), --dist <dir> (по умолчанию <out>/dist),
 *        --model <ключ> (embeddinggemma-300m | qwen3-embedding-0.6b), --threads <n>, --full,
 *        --limit <n> (smoke: первые n статей и квестов), --k <n>, --api <base>, --pause <ms>,
 *        --locales ru,be,uk,pl,en, --queries <file>, --report <file> (eval: markdown-отчёт).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChunkOptions } from './chunk.ts'
import { createEmbedder, runEmbed } from './embed.ts'
import { chunkRawCorpus, runExport } from './export.ts'
import { type ChunkRecord, readIndex, readJsonl, verifyIndex, writeJsonl } from './format.ts'
import { resolveModel } from './models.ts'
import { type EvalQuery, type EvalSummary, evaluate, formatHit, search } from './query.ts'

export interface CliArgs {
  command: string
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): CliArgs {
  const [command = 'help', ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const [name, inline] = arg.slice(2).split('=', 2)
    if (inline !== undefined) {
      flags[name] = inline
    } else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) {
      flags[name] = rest[i + 1]
      i += 1
    } else {
      flags[name] = true
    }
  }
  return { command, positional, flags }
}

const flagString = (flags: CliArgs['flags'], name: string): string | undefined =>
  typeof flags[name] === 'string' ? (flags[name] as string) : undefined
const flagNumber = (flags: CliArgs['flags'], name: string): number | undefined => {
  const raw = flagString(flags, name)
  if (raw === undefined) return undefined
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) throw new Error(`--${name} ожидает число, получено "${raw}"`)
  return value
}

interface Paths {
  outDir: string
  rawDir: string
  workChunks: string
  distDir: string
}

function resolvePaths(flags: CliArgs['flags']): Paths {
  const outDir = path.resolve(flagString(flags, 'out') ?? path.join('.codex-temp', 'ai-index'))
  const distDir = path.resolve(flagString(flags, 'dist') ?? path.join(outDir, 'dist'))
  return { outDir, rawDir: path.join(outDir, 'raw'), workChunks: path.join(outDir, 'work', 'chunks.jsonl'), distDir }
}

const log = (line: string) => console.error(line)

async function commandExport(flags: CliArgs['flags'], paths: Paths) {
  const localesFlag = flagString(flags, 'locales')
  const summary = await runExport({
    rawDir: paths.rawDir,
    apiBase: flagString(flags, 'api'),
    pauseMs: flagNumber(flags, 'pause'),
    full: flags.full === true,
    limit: flagNumber(flags, 'limit'),
    locales: localesFlag?.split(','),
    log,
  })
  console.log(JSON.stringify(summary))
}

function commandChunk(flags: CliArgs['flags'], paths: Paths) {
  const options: ChunkOptions = { size: flagNumber(flags, 'size'), overlap: flagNumber(flags, 'overlap') }
  const localesFlag = flagString(flags, 'locales')
  const { chunks, travels, quests } = chunkRawCorpus(paths.rawDir, options, localesFlag ? localesFlag.split(',') : undefined)
  writeJsonl(paths.workChunks, chunks)
  const summary = {
    travels,
    quests,
    chunks: chunks.length,
    travelChunks: chunks.filter((c) => c.type === 'travel').length,
    questChunks: chunks.filter((c) => c.type === 'quest').length,
    avgChars: chunks.length ? Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length) : 0,
    file: paths.workChunks,
  }
  log(`chunk: статей ${travels}, квестов ${quests}, фрагментов ${chunks.length}`)
  console.log(JSON.stringify(summary))
}

async function withEmbedder<T>(flags: CliArgs['flags'], fn: (embedder: Awaited<ReturnType<typeof createEmbedder>>) => Promise<T>): Promise<T> {
  const spec = resolveModel(flagString(flags, 'model'))
  const embedder = await createEmbedder(spec, { threads: flagNumber(flags, 'threads') })
  try {
    return await fn(embedder)
  } finally {
    await embedder.dispose()
  }
}

async function commandEmbed(flags: CliArgs['flags'], paths: Paths) {
  const chunks = readJsonl<ChunkRecord>(paths.workChunks)
  if (!chunks.length) throw new Error(`нет фрагментов в ${paths.workChunks}: сначала \`chunk\``)
  const summary = await withEmbedder(flags, (embedder) =>
    runEmbed({ chunks, distDir: paths.distDir, embedder, full: flags.full === true, log }),
  )
  console.log(JSON.stringify({ ...summary, dist: paths.distDir }))
}

function commandManifest(paths: Paths) {
  const result = verifyIndex(paths.distDir)
  if (!result.ok) {
    for (const problem of result.problems) log(`manifest: ${problem}`)
    process.exitCode = 1
  }
  console.log(JSON.stringify({ ok: result.ok, dist: paths.distDir, manifest: result.manifest }))
}

async function commandQuery(flags: CliArgs['flags'], positional: string[], paths: Paths) {
  const text = positional.join(' ').trim()
  if (!text) throw new Error('query: укажите текст запроса')
  const artifact = readIndex(paths.distDir)
  if (!artifact) throw new Error(`нет артефакта в ${paths.distDir}: сначала \`embed\``)
  if (flagString(flags, 'model') && flagString(flags, 'model') !== artifact.manifest.model) {
    throw new Error(`индекс собран моделью ${artifact.manifest.model}, запрошена ${flagString(flags, 'model')}`)
  }
  const k = flagNumber(flags, 'k') ?? 5
  const hits = await withEmbedder({ ...flags, model: artifact.manifest.model }, (embedder) => search(embedder, artifact, text, k))
  console.log(`# ${text}\n# индекс: ${artifact.manifest.model}, ${artifact.manifest.count} фрагментов`)
  hits.forEach((hit, i) => console.log(`${i + 1}. ${formatHit(hit)}`))
}

export function renderEvalReport(summary: EvalSummary): string {
  const lines = [
    `| модель | запросов | recall@1 | recall@${summary.k} | MRR | латентность p50, мс | p95, мс |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
    `| ${summary.model} | ${summary.queries} | ${summary.recallAt1.toFixed(2)} | ${summary.recallAtK.toFixed(2)} | ${summary.mrr.toFixed(2)} | ${summary.latencyP50Ms.toFixed(0)} | ${summary.latencyP95Ms.toFixed(0)} |`,
    '',
    '| # | запрос | ранг | top-1 |',
    '| --- | --- | --- | --- |',
    ...summary.results.map((r, i) => `| ${i + 1} | ${r.query} | ${r.rank ?? '—'} | ${r.top[0] ?? ''} |`),
  ]
  return `${lines.join('\n')}\n`
}

async function commandEval(flags: CliArgs['flags'], paths: Paths) {
  const queriesFile = flagString(flags, 'queries')
  if (!queriesFile) throw new Error('eval: укажите --queries <jsonl>')
  const queries = readJsonl<EvalQuery>(queriesFile)
  if (!queries.length) throw new Error(`eval: нет запросов в ${queriesFile}`)
  const artifact = readIndex(paths.distDir)
  if (!artifact) throw new Error(`нет артефакта в ${paths.distDir}`)
  const k = flagNumber(flags, 'k') ?? 5
  const summary = await withEmbedder({ ...flags, model: artifact.manifest.model }, (embedder) => evaluate(embedder, artifact, queries, k))
  const report = renderEvalReport(summary)
  const reportFile = flagString(flags, 'report')
  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true })
    fs.writeFileSync(reportFile, report)
  }
  console.log(report)
  console.log(JSON.stringify({ model: summary.model, queries: summary.queries, recallAt1: summary.recallAt1, k: summary.k, recallAtK: summary.recallAtK, mrr: summary.mrr, latencyP50Ms: summary.latencyP50Ms, latencyP95Ms: summary.latencyP95Ms }))
}

export async function main(argv: string[]): Promise<void> {
  const { command, positional, flags } = parseArgs(argv)
  const paths = resolvePaths(flags)
  switch (command) {
    case 'export':
      await commandExport(flags, paths)
      return
    case 'chunk':
      commandChunk(flags, paths)
      return
    case 'embed':
      await commandEmbed(flags, paths)
      return
    case 'manifest':
      commandManifest(paths)
      return
    case 'query':
      await commandQuery(flags, positional, paths)
      return
    case 'eval':
      await commandEval(flags, paths)
      return
    case 'build':
      await commandExport(flags, paths)
      commandChunk(flags, paths)
      await commandEmbed(flags, paths)
      commandManifest(paths)
      return
    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n/, '').replace(/^ \* ?/gm, ''))
      if (command !== 'help') process.exitCode = 2
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
