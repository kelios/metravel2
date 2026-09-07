/**
 * scripts/lib/skillMirror.js
 * Общая механика каталогов-зеркал скиллов: обход дерева, применение плана и
 * разбор аргументов CLI.
 *
 * #1823: в репозитории два независимых зеркала — `.claude/skills` → `.agents/skills`
 * (`scripts/sync-agent-skills.js`) и `.codex/skills` → `.github/skills`
 * (`scripts/sync-copilot-skills.js`). Механика обхода и записи у них одна и та же;
 * держать её двумя копиями значило бы завести ровно тот рассинхрон, от которого
 * зеркала и защищают, только уровнем выше — в самих синхронизаторах. Здесь лежит
 * только механика, не правила: что считать источником, что vendor-owned и что
 * подлежит удалению, каждая пара решает сама в своём `planSync`.
 */

const fs = require('fs')
const path = require('path')

const toPosix = (value) => String(value || '').replace(/\\/g, '/')

const topSegment = (relativePath) => toPosix(relativePath).split('/')[0]

/** Плоский список `{ path, content }` по всему дереву, пути — относительные и POSIX. */
const collectFiles = (rootDir) => {
  if (!fs.existsSync(rootDir)) return []
  const files = []
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      files.push({ path: toPosix(path.relative(rootDir, absolutePath)), content: fs.readFileSync(absolutePath, 'utf8') })
    }
  }
  walk(rootDir)
  return files
}

const removeEmptyDirsUpTo = (rootDir, startDir) => {
  let current = startDir
  while (current.startsWith(rootDir) && current !== rootDir) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) return
    fs.rmdirSync(current)
    current = path.dirname(current)
  }
}

/** Применяет план к каталогу-зеркалу: записи, удаления и уборка опустевших каталогов. */
const applyMirrorPlan = (targetRoot, plan) => {
  for (const write of plan.writes) {
    const absolutePath = path.join(targetRoot, write.path)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, write.content, 'utf8')
  }
  for (const remove of plan.deletes) {
    const absolutePath = path.join(targetRoot, remove.path)
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath)
    removeEmptyDirsUpTo(targetRoot, path.dirname(absolutePath))
  }
}

const parseMirrorArgs = (argv) => ({
  check: argv.includes('--check'),
  output: argv.includes('--json') ? 'json' : 'text',
})

module.exports = {
  toPosix,
  topSegment,
  collectFiles,
  applyMirrorPlan,
  parseMirrorArgs,
}
