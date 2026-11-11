#!/usr/bin/env node --experimental-strip-types
/**
 * Сборка слепка «похожих» (#3292). Запуск: `npm run ai:similar:build [-- --dist <dir>] [--out <file>]`.
 *
 *   --dist  каталог индекса (по умолчанию .codex-temp/ai-index/dist)
 *   --out   файл слепка (по умолчанию public/assets/data/ai-similar.json — раздаётся сайтом как статика)
 *
 * Порядок обновления: `npm run ai:index -- build` (индекс по текущему каталогу) → эта команда →
 * коммит файла. Свежесть файла проверяет `npm run guard:ai-index-freshness -- --artifact <file>`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadIndex } from './index.ts'
import { buildSimilarArtifact, serializeSimilarArtifact } from './similarArtifact.ts'

const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 ? process.argv[at + 1] : undefined
}

async function main(): Promise<void> {
  const distDir = path.resolve(flag('dist') ?? path.join('.codex-temp', 'ai-index', 'dist'))
  const outFile = path.resolve(flag('out') ?? path.join('public', 'assets', 'data', 'ai-similar.json'))
  const started = Date.now()
  const index = await loadIndex(distDir, { attempts: 1 })
  const artifact = buildSimilarArtifact(index)
  const body = serializeSimilarArtifact(artifact)
  const previous = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, body)
  console.log(
    JSON.stringify({
      out: outFile,
      bytes: Buffer.byteLength(body),
      index_built_at: artifact.index_built_at,
      sources: artifact.sources,
      cards: Object.keys(artifact.cards).length,
      travel: Object.keys(artifact.travel).length,
      quest: Object.keys(artifact.quest).length,
      changed: previous !== body,
      seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    }),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
