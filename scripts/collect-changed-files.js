const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const parseArgs = (argv) => {
  const out = {
    baseSha: String(process.env.BASE_SHA || '').trim(),
    headSha: String(process.env.HEAD_SHA || '').trim(),
    outputFile: 'changed_files.txt',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--base-sha' && argv[i + 1]) {
      out.baseSha = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--head-sha' && argv[i + 1]) {
      out.headSha = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--output-file' && argv[i + 1]) {
      out.outputFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
  }

  return out
}

const normalizeChangedFiles = (raw) => {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const ensureShas = ({ baseSha, headSha }) => {
  if (!baseSha || !headSha) {
    throw new Error('Both base and head commit SHAs are required.')
  }
}

const runGit = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

const collectChangedFiles = ({ baseSha, headSha }) => {
  ensureShas({ baseSha, headSha })

  const fetch = runGit(['fetch', '--no-tags', '--depth=1', 'origin', baseSha])
  if (fetch.status !== 0) {
    throw new Error(`git fetch failed: ${fetch.stderr || fetch.stdout}`)
  }

  const diff = runGit(['diff', '--name-only', baseSha, headSha])
  if (diff.status !== 0) {
    throw new Error(`git diff failed: ${diff.stderr || diff.stdout}`)
  }

  return normalizeChangedFiles(diff.stdout)
}

const writeChangedFiles = (outputFile, files) => {
  const resolved = path.resolve(process.cwd(), outputFile)
  const outputDir = path.dirname(resolved)
  fs.mkdirSync(outputDir, { recursive: true })
  const content = [...files, ''].join('\n')
  fs.writeFileSync(resolved, content, 'utf8')
  return resolved
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const files = collectChangedFiles(args)
    const outputPath = writeChangedFiles(args.outputFile, files)
    console.log(`collect-changed-files: wrote ${files.length} paths to ${outputPath}`)
  } catch (error) {
    console.error(`collect-changed-files: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  normalizeChangedFiles,
  ensureShas,
  collectChangedFiles,
  writeChangedFiles,
}
