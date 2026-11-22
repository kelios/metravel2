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
const collectFiles = (rootDir, include = () => true) => {
  for (const dir of [path.dirname(rootDir), rootDir]) {
    if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Expected a real skill directory at ${dir}`)
    }
  }
  if (!fs.existsSync(rootDir)) return []
  const files = []
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = toPosix(path.relative(rootDir, absolutePath))
      if (!include(relativePath)) continue
      if (entry.isSymbolicLink()) throw new Error(`Unsupported symbolic link in skill mirror: ${absolutePath}`)
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__') continue
        walk(absolutePath)
        continue
      }
      if (!entry.isFile() || entry.name.endsWith('.pyc')) continue
      files.push({
        path: relativePath,
        content: fs.readFileSync(absolutePath),
        executable: Boolean(fs.statSync(absolutePath).mode & 0o100),
      })
    }
  }
  walk(rootDir)
  return files
}

// Git tracks the owner's execution bit. Compare bytes before decoding any command template.
const asBytes = (content) => Buffer.isBuffer(content) ? content : Buffer.from(content)
const sameMirrorFile = (source, target) => Boolean(target)
  && Boolean(source.executable) === Boolean(target.executable)
  && asBytes(source.content).equals(asBytes(target.content))

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
    fs.writeFileSync(absolutePath, write.content)
    if (write.executable !== undefined) {
      const mode = fs.statSync(absolutePath).mode
      if (Boolean(mode & 0o100) !== write.executable) {
        const executeBits = ((mode & 0o444) >> 2) | 0o100
        fs.chmodSync(absolutePath, write.executable ? mode | executeBits : mode & ~0o111)
      }
    }
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
  sameMirrorFile,
  applyMirrorPlan,
  parseMirrorArgs,
}
