#!/usr/bin/env node
'use strict'

// Готовые brotli-копии хешированных JS/CSS выпуска (#2484).
//
// Прод-nginx сжимает статику на лету с `brotli_comp_level 6` и уже держит
// `brotli_static on`: если рядом с файлом лежит `<file>.br`, он отдаётся как
// есть. Сборка таких копий не клала, поэтому каждый чанк ехал в q6. Для
// переводной детали квеста это и есть её добавка к RU: каталог `locale-<lang>`
// (~140 КБ в q6) стоит в head до `entry` и делит с ним канал, а гидратация ждёт
// оба. Уровень 11 снимает с него ~19 %, с остальных чанков — столько же, и
// ускоряет первую загрузку всем языкам, не меняя ни байта самого JS.
//
// Копия обязана совпадать с файлом побайтно: `.br` с чужим содержимым nginx
// отдаст вместо нового JS, и страница исполнит не тот код. Поэтому сжатие
// идёт последним шагом над свежими файлами выпуска (после всех писателей
// чанков и до overlay прошлых поколений), а `--verify` перед выкатом
// распаковывает каждую копию и сверяет её с исходником; осиротевшая копия
// (файла нет) — тоже ошибка.
//
// Usage:
//   node scripts/precompress-static-assets.js <dist>           сжать и проверить
//   node scripts/precompress-static-assets.js --verify <dist>  только проверить

const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const { promisify } = require('util')

const brotliCompress = promisify(zlib.brotliCompress)
const brotliDecompress = promisify(zlib.brotliDecompress)

const STATIC_DIR = path.join('_expo', 'static')
const ASSET_PATTERN = /\.(?:js|css)$/
const COMPRESSED_SUFFIX = '.br'
// zlib уходит в пул потоков libuv: больше параллельных задач, чем потоков,
// ничего не ускорит, а память под буферы растёт.
const CONCURRENCY = Math.max(1, Math.min(4, os.cpus().length))

const listFiles = (root) => {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) out.push(absolute)
      else throw new Error(`precompress: links/special files refused: ${absolute}`)
    }
  }
  walk(root)
  return out.sort()
}

const mapLimit = async (items, limit, worker) => {
  let next = 0
  const run = async () => {
    while (next < items.length) await worker(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
}

const staticRoot = (distDir) => {
  const root = path.join(distDir, STATIC_DIR)
  if (!fs.existsSync(root)) throw new Error(`precompress: no ${STATIC_DIR} under ${distDir}`)
  return root
}

async function compressStaticAssets(distDir) {
  const root = staticRoot(distDir)
  const files = listFiles(root)
  const assets = files.filter((file) => ASSET_PATTERN.test(file))
  const assetSet = new Set(assets)
  // Копия без исходника осталась бы от чужого прогона и смешалась бы с этим.
  for (const file of files) {
    if (file.endsWith(COMPRESSED_SUFFIX) && !assetSet.has(file.slice(0, -COMPRESSED_SUFFIX.length))) {
      fs.unlinkSync(file)
    }
  }
  const result = { files: 0, skipped: 0, rawBytes: 0, compressedBytes: 0 }
  await mapLimit(assets, CONCURRENCY, async (file) => {
    const source = fs.readFileSync(file)
    const compressed = await brotliCompress(source, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    })
    const target = file + COMPRESSED_SUFFIX
    if (compressed.length >= source.length) {
      fs.rmSync(target, { force: true })
      result.skipped += 1
      return
    }
    const temp = `${target}.tmp-${process.pid}`
    fs.writeFileSync(temp, compressed, { flag: 'wx' })
    fs.renameSync(temp, target)
    result.files += 1
    result.rawBytes += source.length
    result.compressedBytes += compressed.length
  })
  return result
}

async function verifyStaticAssets(distDir) {
  const root = staticRoot(distDir)
  const copies = listFiles(root).filter((file) => file.endsWith(COMPRESSED_SUFFIX))
  const problems = []
  await mapLimit(copies, CONCURRENCY, async (copy) => {
    const source = copy.slice(0, -COMPRESSED_SUFFIX.length)
    const relative = path.relative(distDir, copy)
    if (!ASSET_PATTERN.test(source)) return problems.push(`${relative}: not a JS/CSS asset copy`)
    if (!fs.existsSync(source)) return problems.push(`${relative}: source file is missing`)
    let unpacked
    try {
      unpacked = await brotliDecompress(fs.readFileSync(copy))
    } catch (error) {
      return problems.push(`${relative}: not valid brotli (${error.message})`)
    }
    if (!unpacked.equals(fs.readFileSync(source))) problems.push(`${relative}: differs from its source`)
  })
  return { copies: copies.length, problems: problems.sort() }
}

async function main(argv) {
  const verifyOnly = argv.includes('--verify')
  const distArg = argv.find((arg) => !arg.startsWith('--'))
  if (!distArg) throw new Error('Usage: precompress-static-assets.js [--verify] <dist>')
  const distDir = path.resolve(distArg)
  if (!verifyOnly) {
    const started = Date.now()
    const done = await compressStaticAssets(distDir)
    const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1)
    console.log(`precompress: ${done.files} файлов, ${mb(done.rawBytes)} → ${mb(done.compressedBytes)} МБ brotli q11`
      + ` (без копии: ${done.skipped}), ${((Date.now() - started) / 1000).toFixed(1)} с`)
  }
  const { copies, problems } = await verifyStaticAssets(distDir)
  if (problems.length) {
    console.error(`precompress: ${problems.length} brotli-копий не совпадают с исходниками:`)
    for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`)
    return 1
  }
  console.log(`precompress: ${copies} brotli-копий совпадают с исходниками`)
  return 0
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message)
      process.exit(1)
    },
  )
}

module.exports = { compressStaticAssets, verifyStaticAssets }
