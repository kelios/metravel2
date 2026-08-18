#!/usr/bin/env node
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Guard #1448: снимок контента квеста — эфемерный рабочий артефакт, а не данные
// репозитория. Такой файл описывает ЖИВОЕ состояние прода на момент снятия и
// протухает в ту же секунду, когда прод правят дальше: 30 из 33 снимков в
// `scripts/review/` разошлись с продом на 436 полей, а два (`32.json`, `37.json`)
// не резолвились ни в один quest_id. Применение такого файла через
// `scripts/update-quest-content.js` молча откатывает прод на старый текст —
// именно так подсказки, исправленные в #1445/#1447, вернулись бы к виду,
// пересказывающему ответ.
// Единственный источник правды для живого контента — прод; снимки живут в
// gitignored `scripts/.quest-review/` и архивируются сразу после применения.

const OUTPUT_CONTRACT_VERSION = 1

// Каталог, где снимки лежали как tracked-данные. Пуст навсегда: ни одного
// tracked-файла, независимо от расширения.
const BANNED_TRACKED_DIRS = ['scripts/review/']

// Рабочий каталог снимков — gitignored, под git не попадает вообще.
const EPHEMERAL_DIRS = ['scripts/.quest-review/']

const SCANNED_DIRS = ['scripts/']

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const isUnderAny = (relativePath, dirs) => dirs.some((dir) => normalizePath(relativePath).startsWith(dir))

// Форма снимка ревью: JSON с шагами квеста (`steps[].step_id`) либо с intro/finale
// того же формата. `scripts/*-quest-data.js` под это не попадают — это JS-модули
// источников создания новых квестов, а не снимки живого прода.
const hasSnapshotShape = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
  const steps = Array.isArray(parsed.steps) ? parsed.steps : []
  if (steps.some((step) => step && typeof step === 'object' && typeof step.step_id === 'string')) return true
  if (parsed.intro && typeof parsed.intro === 'object' && typeof parsed.intro.step_id === 'string') return true
  return false
}

const evaluateGuard = ({ files }) => {
  const violations = []

  for (const file of files) {
    const relativePath = normalizePath(file.path)

    if (isUnderAny(relativePath, BANNED_TRACKED_DIRS)) {
      violations.push({
        file: relativePath,
        reason: 'каталог снятых снимков ревью не хранится в репозитории (#1448)',
      })
      continue
    }

    if (isUnderAny(relativePath, EPHEMERAL_DIRS)) {
      violations.push({
        file: relativePath,
        reason: 'рабочий каталог снимков gitignored — файл не должен быть под git (#1448)',
      })
      continue
    }

    if (!isUnderAny(relativePath, SCANNED_DIRS)) continue
    if (path.extname(relativePath) !== '.json') continue

    let parsed
    try {
      parsed = JSON.parse(file.content)
    } catch {
      continue
    }

    if (hasSnapshotShape(parsed)) {
      violations.push({
        file: relativePath,
        reason: 'снимок контента квеста (steps[].step_id) не хранится в репозитории (#1448)',
      })
    }
  }

  return violations.length === 0
    ? { ok: true, reason: 'снимков контента квеста под git нет', violations: [] }
    : { ok: false, reason: `снимков контента квеста под git: ${violations.length}`, violations }
}

const parseArgs = (argv) => ({ output: argv.includes('--json') ? 'json' : 'text' })

// Гвард проверяет git-tracked состояние: вне git-чекаута проверять нечего.
// Молча зелёным при этом не притворяемся — печатаем причину.
const isGitCheckout = (rootDir) => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: rootDir, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const collectTrackedFiles = (rootDir) => {
  const stdout = execFileSync('git', ['ls-files', '-z', '--', ...SCANNED_DIRS, ...BANNED_TRACKED_DIRS, ...EPHEMERAL_DIRS], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return stdout
    .split('\0')
    .filter(Boolean)
    // Содержимое нужно только JSON-файлам: форма снимка проверяется парсингом.
    // Пути из BANNED/EPHEMERAL каталогов запрещены сами по себе, без чтения.
    .filter((relativePath) => path.extname(relativePath) === '.json'
      || isUnderAny(relativePath, [...BANNED_TRACKED_DIRS, ...EPHEMERAL_DIRS]))
    .map((relativePath) => {
      const absolutePath = path.join(rootDir, relativePath)
      let content = ''
      try {
        content = fs.readFileSync(absolutePath, 'utf8')
      } catch {
        content = ''
      }
      return { path: relativePath, content }
    })
}

const buildJsonResult = (result) => ({
  contractVersion: OUTPUT_CONTRACT_VERSION,
  ok: result.ok,
  reason: result.reason,
  violations: result.violations,
})

const formatViolations = (violations) => violations.map((v) => `  ${v.file} — ${v.reason}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()

  if (!isGitCheckout(rootDir)) {
    const skipped = { ok: true, reason: 'не git-чекаут: tracked-файлов нет, проверять нечего', violations: [] }
    if (args.output === 'json') {
      process.stdout.write(`${JSON.stringify({ ...buildJsonResult(skipped), skipped: true }, null, 2)}\n`)
      return
    }
    console.log(`quest-review-snapshots: skipped. ${skipped.reason}`)
    return
  }

  const result = evaluateGuard({ files: collectTrackedFiles(rootDir) })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`quest-review-snapshots: passed. ${result.reason}`)
    return
  }

  console.error('quest-review-snapshots: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  console.error('- снимок живого контента прода держи в gitignored scripts/.quest-review/;')
  console.error('  применённый снимок архивируется в scripts/.quest-review/applied/ автоматически.')
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  evaluateGuard,
  hasSnapshotShape,
  buildJsonResult,
}
